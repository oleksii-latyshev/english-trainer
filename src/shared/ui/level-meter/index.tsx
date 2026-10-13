import { litBars } from './lit-bars';
import { levelMeter } from './styles';

const BAR_COUNT = 14;
const BAR_IDS = Array.from({ length: BAR_COUNT }, (_, index) => `bar-${index + 1}`);

const { root, bar } = levelMeter();

type Props = {
  label: string;
  level: number | undefined;
  className?: string;
};

export function LevelMeter({ label, level, className }: Props) {
  const lit = litBars(level, BAR_COUNT);
  return (
    // biome-ignore lint/a11y/useSemanticElements: <meter> cannot draw separate bars.
    <div
      aria-label={label}
      aria-valuemax={1}
      aria-valuemin={0}
      aria-valuenow={level ?? 0}
      className={root({ className })}
      data-slot="level-meter"
      role="meter"
    >
      {BAR_IDS.map((id, index) => (
        <i className={bar()} data-on={index < lit || undefined} key={id} />
      ))}
    </div>
  );
}
