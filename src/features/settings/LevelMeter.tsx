import { litBars } from './lib/levelMeter';

const METER_BARS = 12;
const METER_BAR_IDS = Array.from({ length: METER_BARS }, (_, index) => `bar-${index + 1}`);

/** The design's row of bars for the live microphone input level (0–1). */
export function LevelMeter({ level }: { level: number | undefined }) {
  const lit = litBars(level, METER_BARS);
  return (
    // biome-ignore lint/a11y/useSemanticElements: <meter> cannot draw the design's separate bars.
    <div
      aria-label="Live microphone input level"
      aria-valuemax={1}
      aria-valuemin={0}
      aria-valuenow={level ?? 0}
      className="settings-meter"
      role="meter"
    >
      {METER_BAR_IDS.map((id, index) => (
        <i data-on={index < lit} key={id} />
      ))}
    </div>
  );
}
