import { AlertDialog } from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';
import { entryLabel, type MemoryEntry } from './MemoryRow';

type Props = {
  /** The entry waiting for a yes; the dialog is open while there is one. */
  entry: MemoryEntry | null;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Delete cannot be undone (its history goes too), so it asks first; Archive is the soft way out. */
export function DeleteMemoryDialog({ entry, isBusy, onCancel, onConfirm }: Props) {
  return (
    <AlertDialog
      actions={
        <>
          <Button disabled={isBusy} onClick={onCancel} tone="secondary">
            Cancel
          </Button>
          <Button onClick={onConfirm} pending={isBusy} tone="danger">
            Delete
          </Button>
        </>
      }
      className="max-w-105"
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onCancel();
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
