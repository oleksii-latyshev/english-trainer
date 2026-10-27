import type { MicrophoneStatus } from '@/core/audio';
import { micStatusBox } from './helpers/mic-status-box';

export function MicStatus({ status }: { status: MicrophoneStatus }) {
  const box = micStatusBox(status);
  return (
    <section
      aria-label="Microphone status"
      className="border-line-soft bg-quiet max-rail:hidden mt-auto flex flex-col gap-1.5 rounded-2xl border p-3"
      role="status"
    >
      <div className="text-caption text-quiet-foreground flex items-center gap-2 font-semibold">
        <span
          aria-hidden="true"
          className={box.isOn ? 'bg-warn size-2 rounded-full' : 'bg-faint size-2 rounded-full'}
        />
        {box.title}
      </div>
      <div className="text-faint text-xs leading-snug">{box.hint}</div>
    </section>
  );
}
