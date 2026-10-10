import './eva.css';
import './evaMoods.css';
import type { CSSProperties } from 'react';

// Shared by the Talk start screen, the Talk stage, spoken review, first run and message avatars.
export type EvaMood =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'encouraging'
  | 'curious'
  | 'concerned'
  | 'asleep';

type Props = {
  mood: EvaMood;
  /** Outer size in px, halo included. The sphere is 44% of it. */
  size: number;
  /** Accessible name; defaults to "Eva, <mood>". Pass `decorative` to hide her from assistive tech. */
  label?: string;
  decorative?: boolean;
  /** Normalized learner mic level in [0, 1]. Only affects the listening mood. */
  audioLevel?: number;
};

type EvaStyle = CSSProperties & {
  '--eva-audio-scale'?: number;
  '--eva-audio-opacity'?: number;
};

export function Eva({ mood, size, label, decorative = false, audioLevel }: Props) {
  const accessibility = decorative
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': label ?? `Eva, ${mood}` };
  const level = Math.max(0, Math.min(1, audioLevel ?? 0));
  const style: EvaStyle = { width: size, height: size };
  if (mood === 'listening' && audioLevel !== undefined) {
    style['--eva-audio-scale'] = 1 + level * 0.05;
    style['--eva-audio-opacity'] = 0.35 + level * 0.45;
  }

  return (
    <div className={`eva eva-${mood}`} style={style} {...accessibility}>
      <span className="eva-halo" />
      <span className="eva-ring" />
      <span className="eva-core">
        <b className="eva-face">
          <i className="eva-eye eva-eye-l" />
          <i className="eva-eye eva-eye-r" />
          <i className="eva-mouth" />
        </b>
      </span>
    </div>
  );
}

export function EvaMini() {
  return (
    <span aria-hidden="true" className="eva-mini">
      <i />
      <i />
    </span>
  );
}
