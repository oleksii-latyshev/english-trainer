import { Mic, Play, Square } from 'lucide-react';
import type { MicVariant } from './lib/turnState';

const BAR_WEIGHTS = [
  0.45, 0.7, 0.9, 0.6, 1, 0.75, 0.5, 0.85, 0.65, 1, 0.55, 0.8, 0.95, 0.6, 0.7, 0.9, 0.5, 0.75,
];
const MIN_BAR_PX = 4;
const MAX_BAR_PX = 26;

/** The input level drives the bars; each bar has its own weight so the row looks like a voice. */
export function LevelMeter({ level, isActive }: { level: number; isActive: boolean }) {
  const clamped = Math.max(0, Math.min(1, level));
  // Speech levels are small; the square root lifts them so quiet talkers still see movement.
  const lift = Math.sqrt(clamped);
  return (
    <div className="talk-meter" data-active={isActive}>
      <meter
        aria-label="Microphone level"
        className="sr-only"
        max={100}
        min={0}
        value={Math.round(clamped * 100)}
      />
      {BAR_WEIGHTS.map((weight, index) => (
        <i
          aria-hidden="true"
          // biome-ignore lint/suspicious/noArrayIndexKey: The bars are a fixed decoration with no identity.
          key={index}
          style={{
            height: isActive ? MIN_BAR_PX + (MAX_BAR_PX - MIN_BAR_PX) * lift * weight : MIN_BAR_PX,
          }}
        />
      ))}
    </div>
  );
}

type MicProps = {
  variant: MicVariant;
  icon: 'mic' | 'stop' | 'resume';
  name: string;
  isDisabled: boolean;
  onPress: () => void;
};

export function MicButton({ variant, icon, name, isDisabled, onPress }: MicProps) {
  return (
    <button
      aria-label={name}
      className="talk-mic"
      data-variant={variant}
      disabled={isDisabled}
      onClick={onPress}
      type="button"
    >
      {icon === 'mic' && <Mic aria-hidden="true" size={26} />}
      {icon === 'stop' && <Square aria-hidden="true" fill="currentColor" size={20} />}
      {icon === 'resume' && <Play aria-hidden="true" fill="currentColor" size={22} />}
    </button>
  );
}
