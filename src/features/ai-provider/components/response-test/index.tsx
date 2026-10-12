import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import type { ConversationProvider } from '@/core/ipc';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { answeredByLabel } from '../../helpers/answered-by-label';
import { replyText } from '../../helpers/reply-text';
import { replyTiming } from '../../helpers/reply-timing';
import { providerInstructions, testFailureMessage } from '../../helpers/response-test-copy';
import { responseTestStreamAtom, runResponseTestAtom } from '../../model/atoms';

type Props = { provider: ConversationProvider | null };

export function ResponseTest({ provider }: Props) {
  const result = useAtomValue(runResponseTestAtom);
  const streamed = useAtomValue(responseTestStreamAtom);
  const run = useAtomSet(runResponseTestAtom);
  const isChecking = AsyncResult.isWaiting(result);
  const timing = AsyncResult.isSuccess(result) ? replyTiming(result.value) : null;
  const failure = isChecking ? Option.none() : AsyncResult.error(result);

  function description() {
    if (isChecking) return <>Waiting for the provider…</>;
    if (timing) {
      return (
        <>
          First words <span className="font-mono text-foreground">{timing.firstWords}</span> · Full
          reply <span className="font-mono text-foreground">{timing.fullReply}</span>
        </>
      );
    }
    return <>{providerInstructions(provider)}</>;
  }

  return (
    <>
      <FormRow description={description()} title="Test AI response">
        <Button disabled={isChecking} onClick={() => run(undefined)}>
          {isChecking ? 'Testing…' : 'Run test'}
        </Button>
      </FormRow>
      {isChecking && streamed && (
        <Notice tone="plain">
          <p aria-live="polite">{streamed}</p>
        </Notice>
      )}
      {!isChecking && AsyncResult.isSuccess(result) && (
        <Notice tone="plain">
          <p aria-live="polite" className="whitespace-pre-line">
            {replyText(result.value)}
          </p>
          {result.value.answered_by && (
            <p className="text-caption text-faint">
              Answered by: {answeredByLabel(result.value.answered_by)}
            </p>
          )}
        </Notice>
      )}
      {Option.isSome(failure) && (
        <Notice role="alert" tone="error">
          {testFailureMessage(failure.value, provider)}
        </Notice>
      )}
    </>
  );
}
