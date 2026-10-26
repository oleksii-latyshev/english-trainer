use crate::core::{IpcError, IpcErrorCode};
use crate::providers::{ProviderError, ProviderErrorCode};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConversationError {
    #[error("practice session is not active")]
    InvalidSession,
    #[error("a reply is already being generated")]
    Busy,
    #[error("transcript length is out of range")]
    InvalidTranscript,
    #[error("answer does not match the session phase")]
    InvalidPhaseTransition,
    #[error("retry does not match a reviewed answer")]
    InvalidRetry,
    #[error("practice session is still open")]
    SessionStillOpen,
    #[error("speaking goal not reached before recall")]
    RecallGoalNotReached,
    #[error("invalid phrase id")]
    InvalidPhraseId,
    #[error("phrase is not due for recall")]
    PhraseNotDue,
    #[error("unknown practice topic")]
    UnknownTopic,
    #[error("unsupported session duration")]
    InvalidDuration,
    #[error("custom topic is too long")]
    CustomTopicTooLong,
    #[error("custom topic needs a free topic")]
    CustomTopicNotAllowed,
    #[error("free topic needs a custom topic")]
    FreeTopicNeedsText,
    #[error("no repeated mistakes to practice")]
    NoRepeatedMistakes,
    #[error("mistake practice plan is invalid")]
    MistakePlanInvalid,
    #[error("mistake practice plan names an unknown target")]
    MistakeTargetUnknown,
    #[error("a repeated mistake changed during preparation")]
    MistakeChanged,
    #[error("provider failed: {0:?}")]
    Provider(ProviderError),
    #[error("could not read or write practice sessions")]
    Storage(#[from] rusqlite::Error),
}

impl From<ProviderError> for ConversationError {
    fn from(error: ProviderError) -> Self {
        Self::Provider(error)
    }
}

impl From<ConversationError> for IpcError {
    fn from(error: ConversationError) -> Self {
        use IpcErrorCode::{Busy, DatabaseError, InvalidOutput, InvalidRequest, InvalidSession};
        match error {
            ConversationError::InvalidSession => Self::new(
                InvalidSession,
                "This practice session is no longer active. Start a new session and retry.",
            ),
            ConversationError::Busy => Self::new(
                Busy,
                "A response is already being generated. Please wait and retry.",
            ),
            ConversationError::InvalidTranscript => Self::new(
                InvalidRequest,
                "Transcript must contain between 1 and 4,000 characters.",
            ),
            ConversationError::InvalidPhaseTransition => Self::new(
                InvalidRequest,
                "That answer or practice stage does not match the current session phase. Refresh the session and try again.",
            ),
            ConversationError::InvalidRetry => Self::new(
                InvalidRequest,
                "This retry does not match a reviewed answer. Keep the original answer and try again.",
            ),
            ConversationError::SessionStillOpen => Self::new(
                InvalidRequest,
                "This practice session is still open. Finish it to see its wrap-up.",
            ),
            ConversationError::RecallGoalNotReached => Self::new(
                InvalidRequest,
                "Finish the suggested speaking goal before phrase recall.",
            ),
            ConversationError::InvalidPhraseId => Self::new(InvalidRequest, "Invalid phrase ID."),
            ConversationError::PhraseNotDue => Self::new(
                InvalidRequest,
                "This phrase is no longer due for this session. Refresh recall and try again.",
            ),
            ConversationError::UnknownTopic => Self::new(
                InvalidRequest,
                "Unknown topic. Please choose a valid practice topic.",
            ),
            ConversationError::InvalidDuration => Self::new(
                InvalidRequest,
                "Session duration must be 5, 10, or 15 minutes.",
            ),
            ConversationError::CustomTopicTooLong => Self::new(
                InvalidRequest,
                "Custom topic must be 150 characters or fewer.",
            ),
            ConversationError::CustomTopicNotAllowed => Self::new(
                InvalidRequest,
                "Custom topic text is only valid for a free topic.",
            ),
            ConversationError::FreeTopicNeedsText => Self::new(
                InvalidRequest,
                "Enter a topic before starting a free-topic session.",
            ),
            ConversationError::NoRepeatedMistakes => Self::new(
                InvalidRequest,
                "There are no repeated mistakes to practice yet. Complete a few spoken sessions so Memory can find mistakes to rehearse.",
            ),
            ConversationError::MistakePlanInvalid => Self::new(
                InvalidOutput,
                "The mistake practice provider returned an invalid question plan. Please retry.",
            ),
            ConversationError::MistakeTargetUnknown => Self::new(
                InvalidOutput,
                "The mistake practice provider returned an unknown target. Please retry.",
            ),
            ConversationError::MistakeChanged => Self::new(
                InvalidRequest,
                "A repeated mistake changed while questions were being prepared. Please retry.",
            ),
            ConversationError::Provider(error) => Self::from(error),
            ConversationError::Storage(_) => Self::new(
                DatabaseError,
                "Could not save this practice session locally. Please retry.",
            ),
        }
    }
}

impl From<ConversationError> for ProviderError {
    fn from(error: ConversationError) -> Self {
        match error {
            ConversationError::Provider(error) => error,
            other => Self::from(IpcError::from(other)),
        }
    }
}

pub(crate) fn database_error(_: rusqlite::Error) -> ProviderError {
    ProviderError::new(
        ProviderErrorCode::DatabaseError,
        "Could not save this practice session locally. Please retry.",
    )
}

pub(crate) fn invalid_session_error() -> ProviderError {
    ConversationError::InvalidSession.into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_failures_hide_internal_details() {
        let ipc = IpcError::from(ConversationError::Storage(
            rusqlite::Error::InvalidParameterName("/Users/someone/db.sqlite3".into()),
        ));
        assert_eq!(ipc.code, IpcErrorCode::DatabaseError);
        assert!(!ipc.message.contains("/Users"));
    }

    #[test]
    fn provider_errors_keep_their_code_and_message() {
        let provider = ProviderError::new(ProviderErrorCode::RateLimited, "Slow down.");
        let ipc = IpcError::from(ConversationError::from(provider));
        assert_eq!(ipc, IpcError::new(IpcErrorCode::RateLimited, "Slow down."));
    }

    #[test]
    fn validation_failures_map_to_invalid_request() {
        for error in [
            ConversationError::InvalidTranscript,
            ConversationError::InvalidPhaseTransition,
            ConversationError::InvalidRetry,
            ConversationError::UnknownTopic,
            ConversationError::NoRepeatedMistakes,
        ] {
            assert_eq!(IpcError::from(error).code, IpcErrorCode::InvalidRequest);
        }
    }

    #[test]
    fn session_state_failures_keep_their_dedicated_codes() {
        assert_eq!(
            IpcError::from(ConversationError::InvalidSession).code,
            IpcErrorCode::InvalidSession
        );
        assert_eq!(
            IpcError::from(ConversationError::Busy).code,
            IpcErrorCode::Busy
        );
    }
}
