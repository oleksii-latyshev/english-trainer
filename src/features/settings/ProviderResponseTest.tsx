import { Button, Card } from '@heroui/react';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { type ConversationProviderId, isConversationTurn, isProviderError } from '@/lib/types';

type TestState =
  | { tag: 'idle' }
  | { tag: 'checking' }
  | { tag: 'reply'; text: string; latencyMs?: number }
  | { tag: 'error'; message: string };

function providerInstructions(provider: ConversationProviderId | null): string {
  if (provider === 'apple') {
    return 'This sends the sample sentence “I am testing my English practice setup.” to your configured Apple (on-device) conversation provider. Apple Intelligence requires macOS 26+, Apple Intelligence enabled in System Settings, and on-device models downloaded.';
  }
  if (provider === 'agy') {
    return 'This sends the sample sentence “I am testing my English practice setup.” to your configured Antigravity CLI provider. A detected agy command only confirms that a file exists; it does not confirm account authentication. If the test fails, install Antigravity CLI and sign in using its setup flow; see README → Personal Alpha setup.';
  }
  return 'This sends the sample sentence “I am testing my English practice setup.” to your saved conversation provider.';
}

function providerError(error: unknown, provider: ConversationProviderId | null): string {
  if (isProviderError(error)) return error.message;
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
    latencyMs: result.provider_latency_ms,
  };
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
    setState({ tag: 'checking' });
    try {
      const result: unknown = await invoke<unknown>('generate_follow_up', {
        transcript: 'I am testing my English practice setup.',
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
    <Card className="border border-white/[0.08] bg-[#161619] p-5">
      <h2 className="text-base font-semibold text-zinc-100">Test AI response</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{providerInstructions(provider)}</p>
      <div className="mt-4 flex flex-col gap-3">
        <Button
          isDisabled={state.tag === 'checking'}
          onPress={() => void handleTest()}
          size="sm"
          variant="secondary"
        >
          {state.tag === 'checking' ? 'Waiting for provider…' : 'Test AI response'}
        </Button>
        {state.tag === 'reply' && (
          <div className="rounded-lg bg-black/30 p-3" aria-live="polite">
            <p className="text-sm text-zinc-200">{state.text}</p>
            {typeof state.latencyMs === 'number' && (
              <p className="mt-2 font-mono text-xs text-zinc-400">Latency: {state.latencyMs} ms</p>
            )}
          </div>
        )}
        {state.tag === 'error' && (
          <p className="text-sm text-rose-300" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </Card>
  );
}
