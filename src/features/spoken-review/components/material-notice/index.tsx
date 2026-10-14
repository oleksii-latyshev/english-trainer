import { useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { materialsStateAtom } from '../../model/materials-atoms';
import { useReviewCommands } from '../../model/use-review-commands';
import { isAnsweringAtom } from '../../model/view-atoms';

export function MaterialNotice() {
  const { materials, error, isBusy } = useAtomValue(materialsStateAtom);
  const isAnswering = useAtomValue(isAnsweringAtom);
  const commands = useReviewCommands();
  const preparation = materials?.preparation;
  const failure = (preparation?.state === 'failed' ? preparation.error.message : null) ?? error;

  if (failure) {
    return (
      <Notice
        className="flex items-center justify-between gap-3 rounded-control border"
        role="status"
        tone="warn"
      >
        <span>{failure}</span>
        <Button disabled={isBusy} onClick={commands.retryMaterials} size="sm" tone="secondary">
          Retry situations
        </Button>
      </Notice>
    );
  }
  if (isAnswering && (isBusy || preparation?.state === 'pending')) {
    return (
      <p className="m-0 text-caption text-faint" role="status">
        Preparing review situations…
      </p>
    );
  }
  return null;
}
