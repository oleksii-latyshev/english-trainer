import type { GeminiKeyStatus } from '@/core/ipc';

type Input = {
  readonly draft: string;
  readonly isBusy: boolean;
  readonly status: GeminiKeyStatus | null;
};

export function keyFieldControls({ draft, isBusy, status }: Input) {
  const isRemovableFromSettings = status?.source === 'settings';
  return {
    placeholder: status?.configured ? '••••••••••••••••' : 'Paste your key',
    canSave: !isBusy && draft.trim().length > 0,
    canRemove: !isBusy && isRemovableFromSettings,
  };
}
