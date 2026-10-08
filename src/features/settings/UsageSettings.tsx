import { useCallback, useEffect, useRef, useState } from 'react';
import { type ApiUsageOverview, getApiUsage, type LimitNote } from '@/lib/apiUsageTypes';
import { openExternal } from '@/lib/openExternal';
import { formatRemaining, quotaResetText, requestsLabel } from './lib/usageText';
import { SettingsButton } from './SettingsControls';
import { SettingsBlock, SettingsGroup, SettingsRow } from './SettingsGroup';

const AI_STUDIO_USAGE_URL = 'https://aistudio.google.com/usage';

type LoadState =
  | { tag: 'loading' }
  | { tag: 'ready'; usage: ApiUsageOverview; loadedAtMs: number }
  | { tag: 'error' };

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function LimitText({ note, nowMs, isQuota }: { note: LimitNote; nowMs: number; isQuota: boolean }) {
  return (
    <>
      At {clockTime(note.occurred_at_ms)}: {note.message}
      {isQuota && <> {quotaResetText(note.resets_at_ms, nowMs)}</>}
    </>
  );
}

/** What the app can tell about the Gemini and Antigravity limits; neither provider reports its remaining quota. */
export function UsageSettings() {
  const [state, setState] = useState<LoadState>({ tag: 'loading' });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const usage = await getApiUsage();
      if (request === generation.current) setState({ tag: 'ready', usage, loadedAtMs: Date.now() });
    } catch (cause) {
      console.warn('Could not read the usage counts.', cause);
      if (request === generation.current) setState({ tag: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  return (
    <SettingsGroup id="usage" title="Usage">
      {state.tag === 'loading' && (
        <SettingsBlock role="status" tone="quiet">
          Loading usage…
        </SettingsBlock>
      )}
      {state.tag === 'error' && (
        <SettingsRow
          description="The counts are saved on this Mac. Try again in a moment."
          title="Usage could not be loaded"
        >
          <SettingsButton onClick={() => void load()}>Retry</SettingsButton>
        </SettingsRow>
      )}
      {state.tag === 'ready' && <UsageDetails onRefresh={() => void load()} state={state} />}
    </SettingsGroup>
  );
}

function UsageDetails({
  state,
  onRefresh,
}: {
  state: Extract<LoadState, { tag: 'ready' }>;
  onRefresh: () => void;
}) {
  const { usage, loadedAtMs } = state;
  const { gemini, antigravity } = usage;
  return (
    <>
      <SettingsRow
        description={`Counted by this app. The daily count starts over at midnight Pacific time, in ${formatRemaining(gemini.resets_at_ms - loadedAtMs)}.`}
        title="Gemini API: requests today"
      >
        <SettingsButton onClick={onRefresh} variant="ghost">
          Refresh
        </SettingsButton>
      </SettingsRow>
      {gemini.models.length === 0 && (
        <SettingsBlock tone="quiet">No Gemini requests yet today.</SettingsBlock>
      )}
      {gemini.models.map((entry) => (
        <SettingsRow key={entry.model} title={entry.model}>
          {requestsLabel(entry.requests)}
        </SettingsRow>
      ))}
      <SettingsBlock tone={gemini.last_limit ? 'warn' : 'quiet'}>
        {gemini.last_limit ? (
          <>
            Rate limit reached today.{' '}
            <LimitText isQuota={false} note={gemini.last_limit} nowMs={loadedAtMs} />
          </>
        ) : (
          'No rate-limit errors from Gemini today.'
        )}
      </SettingsBlock>
      <SettingsRow description="Google shows your exact limits there." title="Gemini API limits">
        <SettingsButton
          onClick={() =>
            void openExternal(AI_STUDIO_USAGE_URL).catch((cause: unknown) =>
              console.warn('Could not open the AI Studio usage page.', cause),
            )
          }
        >
          Open AI Studio
        </SettingsButton>
      </SettingsRow>

      <SettingsRow
        description="Coaching, answer examples and memory checks. Antigravity reports no remaining quota, so only what this app sent is counted."
        title="Antigravity: requests today"
      >
        {requestsLabel(antigravity.requests_today)}
      </SettingsRow>
      <SettingsBlock tone={antigravity.last_quota_error ? 'warn' : 'quiet'}>
        {antigravity.last_quota_error ? (
          <>
            Last quota error.{' '}
            <LimitText isQuota note={antigravity.last_quota_error} nowMs={loadedAtMs} />
          </>
        ) : (
          'No Antigravity quota errors recorded.'
        )}
      </SettingsBlock>
    </>
  );
}
