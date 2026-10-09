import type { Page } from '@playwright/test';
import type { FinishedPracticeSession } from '../src/lib/finishedPracticeSession';
import type { PracticeOptions, PracticePhase } from '../src/lib/practiceOptions';
import type { PracticeSession } from '../src/lib/practiceSessionTypes';
import type { ConversationTurn } from '../src/lib/types';

export async function installTauriCommands(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const harness = window.__ET_HARNESS__;
    const callbacks = new Map<number, (payload: unknown) => void>();
    let nextCallback = 1;
    Object.defineProperty(window, 'isTauri', { value: true });

    const record = (value: unknown): Record<string, unknown> => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('Harness expected an IPC argument object.');
      }
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value)) result[key] = Reflect.get(value, key);
      return result;
    };
    const numberArg = (args: Record<string, unknown>, key: string): number => {
      const value = args[key];
      if (typeof value !== 'number') throw new Error(`Harness expected numeric ${key}.`);
      return value;
    };
    const stringArg = (args: Record<string, unknown>, key: string): string => {
      const value = args[key];
      if (typeof value !== 'string') throw new Error(`Harness expected string ${key}.`);
      return value;
    };
    const isTopicId = (value: unknown): value is PracticeOptions['topic_id'] =>
      [
        'work_technology',
        'daily_life',
        'opinions_debates',
        'plans_stories',
        'job_interview_hr',
        'job_interview_behavioural',
        'job_interview_technical',
        'free_topic',
        'free_conversation',
        'random',
      ].some((topicId) => topicId === value);
    const isPracticeMode = (
      value: unknown,
    ): value is NonNullable<PracticeOptions['practice_mode']> =>
      value === 'voice' || value === 'text_chat' || value === 'write_then_speak';
    const isPhase = (value: unknown): value is PracticePhase =>
      value === 'writing' ||
      value === 'writing_review' ||
      value === 'speaking' ||
      value === 'speaking_review';

    function consumeFailure(
      fail: 'failNextStart' | 'failNextSend' | 'failNextTransition',
      message: string,
    ): void {
      if (!harness[fail]) return;
      harness[fail] = false;
      throw { code: 'unavailable', message };
    }
    function saveOptions(provided: unknown): void {
      if (provided === undefined) return;
      const selected = record(provided);
      const topicId = selected.topic_id;
      const custom = selected.topic_custom;
      const duration = selected.duration_goal_seconds;
      const mode = selected.practice_mode ?? 'voice';
      if (
        !isTopicId(topicId) ||
        !(custom === null || typeof custom === 'string') ||
        !(duration === 300 || duration === 600 || duration === 900) ||
        !isPracticeMode(mode)
      )
        throw new Error('Harness received invalid practice options.');
      harness.lastOptions = {
        topic_id: topicId,
        topic_custom: custom,
        duration_goal_seconds: duration,
        practice_mode: mode,
      };
    }
    function createSession(): PracticeSession {
      const practiceMode = harness.lastOptions?.practice_mode ?? 'voice';
      return {
        ...harness.firstSession,
        topic_id: harness.lastOptions?.topic_id ?? harness.firstSession.topic_id,
        topic_label: harness.lastOptions?.topic_custom || harness.firstSession.topic_label,
        topic_custom: harness.lastOptions?.topic_custom ?? null,
        duration_goal_seconds:
          harness.lastOptions?.duration_goal_seconds ?? harness.firstSession.duration_goal_seconds,
        practice_mode: practiceMode,
        practice_phase: practiceMode === 'voice' ? 'speaking' : 'writing',
        written_turn_count: 0,
        spoken_turn_count: 0,
      };
    }
    function start(args: Record<string, unknown>): PracticeSession {
      consumeFailure('failNextStart', 'Could not start practice. Please try again.');
      saveOptions(args.options);
      const session = createSession();
      harness.activeSession = session;
      harness.dialogue = harness.firstDialogue;
      return session;
    }
    function setClock(args: Record<string, unknown>): PracticeSession {
      if (
        !harness.activeSession ||
        harness.activeSession.session_id !== numberArg(args, 'sessionId')
      ) {
        throw new Error('Harness received a clock update for an unknown session.');
      }
      harness.activeSession = { ...harness.activeSession, is_clock_running: args.running === true };
      return harness.activeSession;
    }
    function snapshotForPhase(session: PracticeSession, phase: PracticePhase): PracticeSession {
      const written =
        phase === 'writing_review' ? session.turn_count : (session.written_turn_count ?? 0);
      const spoken =
        phase === 'speaking' ? session.turn_count - written : (session.spoken_turn_count ?? 0);
      return {
        ...session,
        practice_phase: phase,
        written_turn_count: written,
        spoken_turn_count: spoken,
      };
    }
    function transition(args: Record<string, unknown>): PracticeSession {
      if (!harness.activeSession) throw new Error('No active fixture session.');
      if (!isPhase(args.phase)) throw new Error('Harness received an invalid practice phase.');
      if (args.phase === 'speaking') {
        consumeFailure(
          'failNextTransition',
          'Could not move to the next practice stage. Please retry.',
        );
      }
      harness.activeSession = snapshotForPhase(harness.activeSession, args.phase);
      return harness.activeSession;
    }

    const sessionMode = (session: PracticeSession) => session.practice_mode ?? 'voice';
    const sessionPhase = (session: PracticeSession) =>
      session.practice_phase ?? (sessionMode(session) === 'voice' ? 'speaking' : 'writing');
    function spokenCount(session: PracticeSession, total: number, written: number): number {
      const mode = sessionMode(session);
      const phase = sessionPhase(session);
      if (mode === 'voice') return total;
      if (mode === 'write_then_speak' && phase.startsWith('speaking')) return total - written;
      return 0;
    }
    function countsAfterTurn(session: PracticeSession, turnCount: number) {
      const written = session.written_turn_count ?? 0;
      return {
        turn_count: turnCount,
        written_turn_count: written,
        spoken_turn_count: spokenCount(session, turnCount, written),
      };
    }
    function finishedStage(session: PracticeSession) {
      const mode = sessionMode(session);
      const phase = sessionPhase(session);
      const written = phase === 'writing' ? session.turn_count : (session.written_turn_count ?? 0);
      return {
        practice_mode: mode,
        practice_phase: phase,
        written_turn_count: written,
        spoken_turn_count: spokenCount(session, session.turn_count, written),
      };
    }
    function appendTurn(transcript: string, source: 'text' | 'edited' | 'voice'): void {
      if (!harness.dialogue || !harness.activeSession)
        throw new Error('No active fixture session.');
      const session = harness.activeSession;
      harness.dialogue = {
        ...harness.dialogue,
        turns: [
          ...harness.dialogue.turns,
          {
            learner: transcript,
            assistant_reply: 'That sounds useful.',
            assistant_question: 'How did you choose it?',
          },
        ],
        input_sources: [...(harness.dialogue.input_sources ?? []), source],
        reply_times_ms: [...(harness.dialogue.reply_times_ms ?? []), 250],
        answer_durations_ms: [...(harness.dialogue.answer_durations_ms ?? []), null],
        help_used: [...(harness.dialogue.help_used ?? []), false],
        coaching: [...(harness.dialogue.coaching ?? []), { state: 'pending' }],
      };
      harness.activeSession = {
        ...session,
        ...countsAfterTurn(session, harness.dialogue.turns.length),
      };
    }
    function replyChannel(args: Record<string, unknown>): void {
      const channel = args.onReply;
      const id =
        typeof channel === 'object' &&
        channel !== null &&
        'id' in channel &&
        typeof channel.id === 'number'
          ? channel.id
          : typeof channel === 'string' && channel.startsWith('__CHANNEL__:')
            ? Number(channel.slice('__CHANNEL__:'.length))
            : undefined;
      if (id !== undefined)
        callbacks.get(id)?.({ index: 0, message: { kind: 'delta', text: 'That sounds useful.' } });
    }
    function send(args: Record<string, unknown>): ConversationTurn {
      consumeFailure('failNextSend', 'The AI follow-up could not be generated. Please try again.');
      const transcript = stringArg(args, 'transcript');
      const source = args.inputSource;
      if (source !== 'text' && source !== 'edited' && source !== 'voice') {
        throw new Error('Harness received an invalid input source.');
      }
      appendTurn(transcript, source);
      replyChannel(args);
      return {
        spoken_reply: 'That sounds useful.',
        question: 'How did you choose it?',
        session_phase: 'practice',
        is_complete: false,
        provider_latency_ms: 250,
        first_token_ms: 100,
      };
    }
    function finish(args: Record<string, unknown>): FinishedPracticeSession {
      const id = numberArg(args, 'sessionId');
      if (!harness.activeSession || harness.activeSession.session_id !== id) {
        throw new Error('Harness received an invalid finish request.');
      }
      const session = harness.activeSession;
      harness.finished = {
        ...harness.finishedTemplate,
        session_id: id,
        topic_label: session.topic_label,
        turn_count: session.turn_count,
        duration_ms: session.active_duration_ms,
        duration_goal_seconds: session.duration_goal_seconds,
        ...finishedStage(session),
      };
      harness.activeSession = null;
      return harness.finished;
    }
    const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
      get_active_practice_session: () => harness.activeSession,
      get_ai_settings: () => ({ provider: 'gemini', agy_model: 'default', eva_style: 'natural' }),
      get_gemini_key_status: () => ({ configured: false, source: null }),
      get_learning_memory: () => ({ mistakes: [], phrase_cards: [], due_count: 0 }),
      get_question_scaffold: () => ({
        sentence_starters: ['One tool I use is…'],
        useful_expressions: ['It saves me time.'],
        structure: ['Name the tool', 'Explain why it helps', 'Give an example'],
      }),
      start_practice_session: start,
      set_practice_clock: setClock,
      transition_practice_phase: transition,
      get_practice_dialogue: (args) => {
        if (!harness.dialogue || harness.dialogue.session_id !== numberArg(args, 'sessionId')) {
          throw new Error('Harness could not find the requested dialogue.');
        }
        return harness.dialogue;
      },
      send_practice_turn: send,
      finish_practice_session: finish,
      get_session_wrapup: () => harness.finished,
      prewarm_conversation_provider: () => undefined,
      set_dock_icon: () => undefined,
      warm_speech_engine: () => undefined,
      'plugin:event|listen': () => 1,
      'plugin:event|unlisten': () => undefined,
    };
    const internals = {
      invoke: async (command: string, rawArgs: unknown = {}): Promise<unknown> => {
        const args = record(rawArgs);
        harness.calls.push({ command, args });
        const handler = handlers[command];
        if (!handler) {
          const message = `Unhandled Tauri command in E2E fixture: ${command}`;
          harness.errors.push(message);
          throw new Error(message);
        }
        return handler(args);
      },
      transformCallback: (callback: (payload: unknown) => void): number => {
        const id = nextCallback++;
        callbacks.set(id, callback);
        return id;
      },
      unregisterCallback: (id: number): void => {
        callbacks.delete(id);
      },
    };
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: internals });
    Object.defineProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', {
      value: { unregisterListener: () => undefined },
    });
  });
}
