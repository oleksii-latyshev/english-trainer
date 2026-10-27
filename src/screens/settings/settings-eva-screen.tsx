import { EvaSettings } from '@/features/eva-settings';
import { Button } from '@/shared/ui/button';
import type { SettingsEvaScreenProps } from './types';

export function SettingsEvaScreen({ onBack }: SettingsEvaScreenProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Button className="self-start" onClick={onBack} tone="ghost">
          ← Settings
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Eva</h1>
        <p className="text-muted">
          How your conversation partner looks, grows and what her face is telling you.
        </p>
      </div>
      <EvaSettings />
    </div>
  );
}
