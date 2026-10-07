import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { answeredByLabel } from '@/lib/answeredBy';
import { createReplyChannel } from '@/lib/replyStream';
import { type ConversationProviderId, isConversationTurn, isProviderError } from '@/lib/types';
import { formatSeconds } from './lib/levelMeter';
import { SettingsButton } from './SettingsControls';
import { SettingsBlock, SettingsRow } from './SettingsGroup';

type TestState =
  | { tag: 'idle' }
  | { tag: 'checking'; streamed: string }
  | { tag: 'reply'; text: string; firstTokenMs?: number; latencyMs?: number; answeredBy?: string }
  | { tag: 'error'; message: string };

const SAMPLE_SENTENCE = 'I am testing my English practice setup.';

function providerInstructions(provider: ConversationProviderId | null): string {
  const sample = `Sends “${SAMPLE_SENTENCE}” to`;
  if (provider === 'apple') {
    return `${sample} Apple on-device. It needs macOS 26+, Apple Intelligence enabled in System Settings, and the on-device models downloaded.`;
  }
  if (provider === 'gemini') return `${sample} the Gemini API with your saved key.`;
  if (provider === 'agy') {
    return `${sample} Antigravity CLI. A found agy command does not prove you are signed in; if the test fails, sign in using its setup flow (README, Personal Alpha setup).`;
  }
  return `${sample} your saved conversation provider.`;
}

function providerError(error: unknown, provider: ConversationProviderId | null): string {
  if (isProviderError(error)) return error.message;
  if (provider === 'gemini') {
    return 'The Gemini test failed. Check the API key and your internet connection, then try again.';
  }
  if (provider === 'apple') {
    return 'The Apple provider test failed. Check Apple Intelligence setup and try again.';
  }
  if (provider === 'agy') return 'The provider test failed. Check the agy setup and try again.';
  return 'The configured provider test failed. Check conversation AI settings and try again.';
}

function responseState(result: unknown): TestState {
  if (!isConversationTurn(result)) {
    return {
      tag: 'error',
      message:
        'The provider returned a response the app could not read. Check setup and try again.',
    };
  }
  return {
    tag: 'reply',
    text: result.question ? `${result.spoken_reply}\n\n${result.question}` : result.spoken_reply,
    firstTokenMs: result.first_token_ms,
    latencyMs: result.provider_latency_ms,
    answeredBy: result.answered_by ? answeredByLabel(result.answered_by) : undefined,
  };
}

function RowDescription({
  state,
  provider,
}: {
  state: TestState;
  provider: ConversationProviderId | null;
}) {
  if (state.tag === 'checking') return <>Waiting for the provider…</>;
  if (state.tag === 'reply' && typeof state.latencyMs === 'number') {
    return (
      <>
        First words{' '}
        <span className="settings-mono">
          {formatSeconds(state.firstTokenMs ?? state.latencyMs, 2)}
        </span>{' '}
        · Full reply <span className="settings-mono">{formatSeconds(state.latencyMs, 1)}</span>
      </>
    );
  }
  return <>{providerInstructions(provider)}</>;
}

export function ProviderResponseTest({ provider }: { provider: ConversationProviderId | null }) {
  const [state, setState] = useState<TestState>({ tag: 'idle' });
  const generation = useRef(0);
  const inFlight = useRef(false);

  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  async function handleTest() {
    if (inFlight.current) return;
    inFlight.current = true;
    const request = ++generation.current;
    setState({ tag: 'checking', streamed: '' });
    try {
      const onReply = createReplyChannel((text) => {
        if (request !== generation.current) return;
        setState((current) =>
          current.tag === 'checking'
            ? { tag: 'checking', streamed: current.streamed + text }
            : current,
        );
      });
      const result: unknown = await invoke<unknown>('generate_follow_up', {
        transcript: SAMPLE_SENTENCE,
        onReply,
      });
      if (request === generation.current) setState(responseState(result));
    } catch (error) {
      if (request === generation.current) {
        setState({ tag: 'error', message: providerError(error, provider) });
      }
    } finally {
      if (request === generation.current) inFlight.current = false;
    }
  }

  return (
    <>
      <SettingsRow
        description={<RowDescription provider={provider} state={state} />}
        title="Test AI response"
      >
        <SettingsButton disabled={state.tag === 'checking'} onClick={() => void handleTest()}>
          {state.tag === 'checking' ? 'Testing…' : 'Run test'}
        </SettingsButton>
      </SettingsRow>
      {state.tag === 'checking' && state.streamed && (
        <SettingsBlock tone="plain">
          <p aria-live="polite">{state.streamed}</p>
        </SettingsBlock>
      )}
      {state.tag === 'reply' && (
        <SettingsBlock tone="plain">
          <p aria-live="polite" style={{ whiteSpace: 'pre-line' }}>
            {state.text}
          </p>
          {state.answeredBy && <p className="settings-quiet">Answered by: {state.answeredBy}</p>}
        </SettingsBlock>
      )}
      {state.tag === 'error' && (
        <SettingsBlock role="alert" tone="error">
          {state.message}
        </SettingsBlock>
      )}
    </>
  );
}
