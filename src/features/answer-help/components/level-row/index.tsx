import { ChoiceChip } from '@/shared/ui/choice-chip';
import { Kbd } from '@/shared/ui/kbd';
import { HELP_LEVELS, type HelpLevel } from '../../helpers/help-levels';

type Props = {
  level: HelpLevel | null;
  isDisabled: boolean;
  onChoose: (level: HelpLevel | null) => void;
};

export function LevelRow({ level, isDisabled, onChoose }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-faint mr-1">Need help?</span>
      {HELP_LEVELS.map((item) => (
        <ChoiceChip
          disabled={isDisabled}
          isSelected={level === item.id}
          key={item.id}
          onSelect={() => onChoose(level === item.id ? null : item.id)}
        >
          <span aria-hidden="true" className="text-faint mr-1.5 font-mono text-xs font-medium">
            {item.keyNumber}
          </span>
          {item.label}
        </ChoiceChip>
      ))}
      <span className="text-faint ml-auto inline-flex items-center gap-1.5 text-xs">
        <Kbd>H</Kbd>
        help
      </span>
    </div>
  );
}
