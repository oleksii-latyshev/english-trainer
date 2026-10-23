use super::{active_session_mut, SessionStore};
use crate::conversation::domain::context_builder::{build_context, ContextInput};
use crate::conversation::domain::rehearsal::{
    scripted_reply, validate_answer_source, ScriptedReply,
};
use crate::conversation::domain::rules::validate_transcript;
use crate::conversation::domain::{InputSource, StoredTurn};
use crate::conversation::error::ConversationError;
use crate::conversation::ports::ReplyEngine;
use crate::providers::{cancelled_reply, ConversationContext, ConversationTurn};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

struct PreparedTurn {
    context: ConversationContext,
    cancellation: Arc<AtomicBool>,
    scripted: Option<ScriptedReply>,
}

impl SessionStore {
    pub fn send_turn_with_engine(
        &self,
        session_id: u64,
        transcript: String,
        input_source: InputSource,
        answer_duration_ms: Option<u64>,
        engine: &mut dyn ReplyEngine,
    ) -> Result<ConversationTurn, ConversationError> {
        validate_transcript(&transcript)?;
        let prepared = self.begin_turn(session_id, &transcript, input_source)?;
        let result = match &prepared.scripted {
            Some(scripted) => Ok(scripted.turn()),
            None => engine.generate(&prepared.context, prepared.cancellation.clone()),
        };
        self.complete_turn(
            session_id,
            prepared,
            result,
            input_source,
            answer_duration_ms,
        )
    }

    fn begin_turn(
        &self,
        session_id: u64,
        transcript: &str,
        input_source: InputSource,
    ) -> Result<PreparedTurn, ConversationError> {
        let mut state = self.lock();
        let session = state
            .active
            .as_ref()
            .filter(|session| session.id == session_id)
            .ok_or(ConversationError::InvalidSession)?;
        if session.in_flight {
            return Err(ConversationError::Busy);
        }
        validate_answer_source(session, input_source)?;
        let scripted = scripted_reply(session)?;
        let needs_learning_targets =
            !session.is_mistake_practice && (session.turns.len() == 1 || session.turns.len() == 5);
        let learning_targets = if needs_learning_targets {
            state.database.due_learning_targets(session_id)?
        } else {
            Vec::new()
        };
        let profile = state.database.get_personal_profile()?;
        let session = active_session_mut(&mut state, session_id)?;
        session.in_flight = true;
        session.reply_cancelled = Arc::new(AtomicBool::new(false));
        let cancellation = session.reply_cancelled.clone();
        let context = build_context(ContextInput {
            opening_question: &session.opening_question,
            prior_turns: &session.turns,
            latest_transcript: transcript,
            learning_targets,
            profile: Some(profile),
            topic: Some(session.topic_label.clone()),
        });
        Ok(PreparedTurn {
            context,
            cancellation,
            scripted,
        })
    }

    fn complete_turn(
        &self,
        session_id: u64,
        prepared: PreparedTurn,
        result: Result<ConversationTurn, crate::providers::ProviderError>,
        input_source: InputSource,
        answer_duration_ms: Option<u64>,
    ) -> Result<ConversationTurn, ConversationError> {
        let mut state = self.lock();
        if prepared.cancellation.load(Ordering::Acquire) {
            return Err(cancelled_reply().into());
        }
        let turn = match result {
            Ok(turn) => turn,
            Err(error) => {
                if let Ok(session) = active_session_mut(&mut state, session_id) {
                    session.in_flight = false;
                }
                return Err(error.into());
            }
        };
        let session = active_session_mut(&mut state, session_id)?;
        session.in_flight = false;
        let sequence = session.turns.len() + 1;
        let stored = StoredTurn {
            learner: prepared.context.latest_transcript,
            assistant_reply: turn.spoken_reply.clone(),
            assistant_question: turn.question.clone().unwrap_or_default(),
            answered_by: turn.answered_by.clone(),
        };
        state.database.save_turn_with_details(
            session_id,
            sequence,
            &stored,
            input_source.as_str(),
            turn.reply_time_ms(),
            answer_duration_ms.filter(|_| input_source != InputSource::Text),
        )?;
        active_session_mut(&mut state, session_id)?
            .turns
            .push(stored);
        Ok(turn)
    }

    #[cfg(test)]
    pub fn send_turn<F>(
        &self,
        session_id: u64,
        transcript: String,
        generate: F,
    ) -> Result<ConversationTurn, ConversationError>
    where
        F: FnOnce(
            &ConversationContext,
        ) -> Result<ConversationTurn, crate::providers::ProviderError>,
    {
        self.send_turn_with_source(session_id, transcript, InputSource::Voice, None, generate)
    }

    #[cfg(test)]
    pub fn send_turn_with_source<F>(
        &self,
        session_id: u64,
        transcript: String,
        input_source: InputSource,
        answer_duration_ms: Option<u64>,
        generate: F,
    ) -> Result<ConversationTurn, ConversationError>
    where
        F: FnOnce(
            &ConversationContext,
        ) -> Result<ConversationTurn, crate::providers::ProviderError>,
    {
        self.send_turn_cancellable(
            session_id,
            transcript,
            input_source,
            answer_duration_ms,
            |context, _| generate(context),
        )
    }

    #[cfg(test)]
    pub fn send_turn_cancellable<F>(
        &self,
        session_id: u64,
        transcript: String,
        input_source: InputSource,
        answer_duration_ms: Option<u64>,
        generate: F,
    ) -> Result<ConversationTurn, ConversationError>
    where
        F: FnOnce(
            &ConversationContext,
            Arc<AtomicBool>,
        ) -> Result<ConversationTurn, crate::providers::ProviderError>,
    {
        let mut engine = OnceEngine(Some(generate));
        self.send_turn_with_engine(
            session_id,
            transcript,
            input_source,
            answer_duration_ms,
            &mut engine,
        )
    }
}

#[cfg(test)]
struct OnceEngine<F>(Option<F>);

#[cfg(test)]
impl<F> ReplyEngine for OnceEngine<F>
where
    F: FnOnce(
        &ConversationContext,
        Arc<AtomicBool>,
    ) -> Result<ConversationTurn, crate::providers::ProviderError>,
{
    fn generate(
        &mut self,
        context: &ConversationContext,
        cancelled: Arc<AtomicBool>,
    ) -> Result<ConversationTurn, crate::providers::ProviderError> {
        match self.0.take() {
            Some(generate) => generate(context, cancelled),
            None => Err(crate::providers::ProviderError::new(
                crate::providers::ProviderErrorCode::Unavailable,
                "The reply engine was already used.",
            )),
        }
    }
}
