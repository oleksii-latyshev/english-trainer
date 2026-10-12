import { useNavigate } from '@tanstack/react-router';
import { EvaSettings } from '@/features/eva-settings';

export function EvaSettingsView() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <button
          className="settings-link"
          onClick={() => void navigate({ to: '/settings' })}
          type="button"
        >
          ← Settings
        </button>
        <h1 className="font-bold text-3xl tracking-tight">Eva</h1>
        <p className="text-muted">
          How your conversation partner looks, grows and what her face is telling you.
        </p>
      </div>
      <EvaSettings />
    </div>
  );
}
