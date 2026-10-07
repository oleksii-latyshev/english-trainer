import { AlertDialog, Button } from '@heroui/react';
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
    <AlertDialog.Backdrop
      isOpen={entry !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isBusy) onCancel();
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className="sm:max-w-[420px]">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete from Memory?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              {entry ? `“${entryLabel(entry)}”` : ''} and everything saved about it will be removed.
              This can’t be undone. Archive it instead to just hide it.
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button isDisabled={isBusy} onPress={onCancel} variant="secondary">
              Cancel
            </Button>
            <Button isPending={isBusy} onPress={onConfirm} variant="danger">
              Delete
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
