import { useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { openExternalLinkAtom } from '@/core/external-link';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { usageShare } from '../../helpers/usage-share';
import { dailyCountResetText } from '../../helpers/usage-text';
import { apiUsageAtom } from '../../model/atoms';
import type { ApiUsageSnapshot } from '../../types';
import { LimitText } from '../limit-text';
import { ModelRequestsRow } from '../model-requests-row';

const AI_STUDIO_USAGE_URL = 'https://aistudio.google.com/usage';

function UsageDetails({ snapshot }: { snapshot: ApiUsageSnapshot }) {
  const refresh = useAtomRefresh(apiUsageAtom);
  const openLink = useAtomSet(openExternalLinkAtom);
  const { usage, loadedAtMs } = snapshot;
  const { gemini, antigravity } = usage;

  return (
    <>
      <FormRow
        description={dailyCountResetText(gemini.resets_at_ms, loadedAtMs)}
        title="Gemini API: requests today"
      >
        <Button onClick={refresh} tone="ghost">
          Refresh
        </Button>
      </FormRow>
      {gemini.models.length === 0 && <Notice tone="quiet">No Gemini requests yet today.</Notice>}
      {gemini.models.map((entry) => (
        <ModelRequestsRow
          key={entry.model}
          model={entry.model}
          requests={entry.requests}
          share={usageShare(entry, gemini.models)}
        />
      ))}
      <Notice tone={gemini.last_limit ? 'warn' : 'quiet'}>
        {gemini.last_limit ? (
          <>
            Rate limit reached today.{' '}
            <LimitText note={gemini.last_limit} nowMs={loadedAtMs} showsReset={false} />
          </>
        ) : (
          'No rate-limit errors from Gemini today.'
        )}
      </Notice>
      <FormRow description="Google shows your exact limits there." title="Gemini API limits">
        <Button onClick={() => openLink(AI_STUDIO_USAGE_URL)}>Open AI Studio</Button>
      </FormRow>
      <FormRow
        description="Coaching, answer examples and memory checks. Antigravity reports no remaining quota, so only what this app sent is shown."
        title={
          <>
            Antigravity: requests today{' '}
            <span className="text-quiet-foreground ml-1.5 font-mono font-medium">
              {antigravity.requests_today}
            </span>
          </>
        }
      />
      <Notice tone={antigravity.last_quota_error ? 'warn' : 'quiet'}>
        {antigravity.last_quota_error ? (
          <>
            Last quota error.{' '}
            <LimitText note={antigravity.last_quota_error} nowMs={loadedAtMs} showsReset />
          </>
        ) : (
          'No Antigravity quota errors recorded.'
        )}
      </Notice>
    </>
  );
}

export function ApiUsageSettings() {
  const result = useAtomValue(apiUsageAtom);
  const retry = useAtomRefresh(apiUsageAtom);
  const snapshot = Option.getOrNull(AsyncResult.value(result));

  if (snapshot !== null) return <UsageDetails snapshot={snapshot} />;
  if (AsyncResult.isFailure(result)) {
    return (
      <FormRow
        description="The counts are saved on this Mac. Try again in a moment."
        title="Usage could not be loaded"
      >
        <Button onClick={retry}>Retry</Button>
      </FormRow>
    );
  }
  return (
    <Notice role="status" tone="quiet">
      Loading usage…
    </Notice>
  );
}
