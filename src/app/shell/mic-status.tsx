import type { MicrophoneStatus } from '@/core/audio';
import { micStatusBox } from './helpers/mic-status-box';

export function MicStatus({ status }: { status: MicrophoneStatus }) {
  const box = micStatusBox(status);
  return (
    <section
      aria-label="Microphone status"
      className="mt-auto flex flex-col gap-1.5 rounded-2xl border border-line-soft bg-quiet p-3 max-rail:hidden"
      role="status"
    >
      <div className="flex items-center gap-2 font-semibold text-caption text-quiet-foreground">
        <span
          aria-hidden="true"
          className={box.isOn ? 'size-2 rounded-full bg-warn' : 'size-2 rounded-full bg-faint'}
        />
        {box.title}
      </div>
      <div className="text-faint text-xs leading-snug">{box.hint}</div>
    </section>
  );
}
