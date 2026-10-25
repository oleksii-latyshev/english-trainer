import { toast } from '@/shared/ui/toast';

const SAVED_MESSAGE = 'Saved to Memory — it’ll come back in a later session.';
const REMOVED_MESSAGE = 'Removed from Memory';
const UNDO_FAILED_MESSAGE = 'Could not undo the save. Remove it from Memory instead.';

export function showSavedToast(onUndo?: () => void): void {
  if (onUndo === undefined) {
    toast.success(SAVED_MESSAGE);
    return;
  }
  const toastId = toast.success(SAVED_MESSAGE, {
    action: {
      label: 'Undo',
      onClick: () => {
        toast.close(toastId);
        onUndo();
      },
    },
  });
}

export function showRemovedToast(): void {
  toast(REMOVED_MESSAGE);
}

export function showUndoFailedToast(): void {
  toast.danger(UNDO_FAILED_MESSAGE);
}
