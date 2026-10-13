import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult } from 'effect/reactivity';
import { AlertDialog } from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { entryLabel } from '../../helpers/memory-entries';
import { confirmDeleteAtom, pendingDeleteAtom } from '../../model/atoms';

export function DeleteMemoryDialog() {
  const [entry, setPending] = useAtom(pendingDeleteAtom);
  const confirm = useAtomSet(confirmDeleteAtom);
  const isBusy = AsyncResult.isWaiting(useAtomValue(confirmDeleteAtom));

  return (
    <AlertDialog
      actions={
        <>
          <Button disabled={isBusy} onClick={() => setPending(null)} tone="secondary">
            Cancel
          </Button>
          <Button onClick={() => confirm(undefined)} pending={isBusy} tone="danger">
            Delete
          </Button>
        </>
      }
      className="max-w-105"
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) setPending(null);
      }}
      open={entry !== null}
      title="Delete from Memory?"
      tone="danger"
    >
      <p>
        {entry ? `“${entryLabel(entry)}”` : ''} and everything saved about it will be removed. This
        can’t be undone. Archive it instead to just hide it.
      </p>
    </AlertDialog>
  );
}
