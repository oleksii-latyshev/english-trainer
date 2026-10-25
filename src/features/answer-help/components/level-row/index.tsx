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
      <span className="mr-1 text-caption text-faint">Need help?</span>
      {HELP_LEVELS.map((item) => (
        <ChoiceChip
          disabled={isDisabled}
          isSelected={level === item.id}
          key={item.id}
          onSelect={() => onChoose(level === item.id ? null : item.id)}
        >
          <span aria-hidden="true" className="mr-1.5 font-medium font-mono text-faint text-xs">
            {item.keyNumber}
          </span>
          {item.label}
        </ChoiceChip>
      ))}
      <span className="ml-auto inline-flex items-center gap-1.5 text-faint text-xs">
        <Kbd>H</Kbd>
        help
      </span>
    </div>
  );
}
