import type { ConversationProvider } from '@/core/ipc';
import { FormRowDescription, FormRowTitle } from '@/shared/ui/form-row';
import { PROVIDER_CARDS } from './constants';

type Props = {
  provider: ConversationProvider;
  disabled: boolean;
  onChoose: (provider: ConversationProvider) => void;
};

export function ProviderChoice({ provider, disabled, onChoose }: Props) {
  return (
    <div
      aria-label="Conversation AI provider"
      className="flex flex-col gap-2 border-line border-t px-5 pt-3 pb-4"
      role="radiogroup"
    >
      {PROVIDER_CARDS.map((card) => (
        <label
          className="relative flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 has-disabled:cursor-default has-checked:border-accent-line has-checked:bg-accent-soft has-disabled:opacity-60 has-focus-visible:outline-2 has-focus-visible:outline-accent has-focus-visible:outline-offset-2"
          key={card.id}
        >
          <input
            checked={provider === card.id}
            className="peer sr-only"
            disabled={disabled}
            name="conversation-provider"
            onChange={() => onChoose(card.id)}
            type="radio"
            value={card.id}
          />
          <span
            aria-hidden="true"
            className="mt-0.5 size-4 flex-none rounded-full border-2 border-faint peer-checked:border-accent peer-checked:bg-accent peer-checked:shadow-[inset_0_0_0_3px_var(--color-background)]"
          />
          <span className="min-w-0">
            <FormRowTitle>
              {card.name}
              {card.badge && (
                <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 font-bold text-[11px] text-on-accent">
                  {card.badge}
                </span>
              )}
              {card.isLegacy && <span className="text-caption text-faint"> · legacy</span>}
            </FormRowTitle>
            <FormRowDescription>{card.description}</FormRowDescription>
          </span>
        </label>
      ))}
    </div>
  );
}
