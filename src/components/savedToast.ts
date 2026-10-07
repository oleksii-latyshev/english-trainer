import { toast } from '@heroui/react';

const SAVED_MESSAGE = 'Saved to Memory — it’ll come back in a later session.';

type Options = {
  /** Present only when this save created cards; undoing must never remove older ones. */
  onUndo?: () => Promise<void>;
};

/** The "Saved to Memory" toast, with an Undo while the save can still be taken back. */
export function showSavedToast({ onUndo }: Options = {}): void {
  if (!onUndo) {
    toast.success(SAVED_MESSAGE);
    return;
  }
  const toastId = toast.success(SAVED_MESSAGE, {
    actionProps: {
      children: 'Undo',
      onPress: () => {
        toast.close(toastId);
        onUndo().then(
          () => toast('Removed from Memory'),
          () => toast.danger('Could not undo the save. Remove it from Memory instead.'),
        );
      },
    },
  });
}
