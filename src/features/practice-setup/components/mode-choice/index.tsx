import { Keyboard, Mic, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { OptionCard } from '@/shared/ui/option-card';
import { MODE_CHOICES } from '../../constants';
import type { PracticeMode } from '../../types';

type Props = {
  value: PracticeMode;
  onChange: (mode: PracticeMode) => void;
  disabled: boolean;
};

const MODE_ICONS: Record<PracticeMode, ReactNode> = {
  voice: <Mic size={18} strokeWidth={1.7} />,
  text_chat: <Keyboard size={18} strokeWidth={1.7} />,
  write_then_speak: <PenLine size={18} strokeWidth={1.7} />,
};

export function ModeChoice({ value, onChange, disabled }: Props) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-3" disabled={disabled}>
      <legend className="mb-3 font-semibold text-caption text-faint">How</legend>
      <div className="grid grid-cols-3 gap-3 max-rail:grid-cols-1">
        {MODE_CHOICES.map((mode) => (
          <OptionCard
            description={mode.description}
            disabled={disabled}
            icon={MODE_ICONS[mode.id]}
            isSelected={value === mode.id}
            key={mode.id}
            onSelect={() => onChange(mode.id)}
            title={mode.title}
          />
        ))}
      </div>
    </fieldset>
  );
}
