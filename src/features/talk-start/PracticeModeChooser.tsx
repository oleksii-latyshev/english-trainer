import { PRACTICE_MODES, type PracticeMode, practiceModeLabel } from '@/lib/practiceOptions';
import { modeDescription } from './practiceModeCopy';

export function PracticeModeChooser({
  value,
  onChange,
}: {
  value: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}) {
  return (
    <fieldset className="talk-start-mode-options">
      <legend className="talk-start-section-title">How would you like to practise?</legend>
      <div className="talk-mode-grid">
        {PRACTICE_MODES.map((mode) => (
          <button
            aria-pressed={value === mode}
            className="talk-topic-option"
            key={mode}
            onClick={() => onChange(mode)}
            type="button"
          >
            <span className="talk-topic-option-title">{practiceModeLabel(mode)}</span>
            <span className="talk-topic-option-description">{modeDescription(mode)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
