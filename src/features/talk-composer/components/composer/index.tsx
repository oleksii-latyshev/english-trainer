import { useAtomValue } from '@effect/atom-react';
import { type ReactNode, useState } from 'react';
import { Kbd } from '@/shared/ui/kbd';
import { canEditDraft, canOfferTypeInstead } from '../../helpers/composer-draft';
import { changeDraft, sendDraft } from '../../model/commands';
import { useComposerRegistry, useTurn } from '../../model/use-composer';
import {
  interactionAtom,
  isAudioStageAtom,
  isLockedAtom,
  isPracticeBusyAtom,
} from '../../model/view-atoms';
import { DraftField } from '../draft-field';
import { MicRow } from '../mic-row';
import { TurnActions } from '../turn-actions';
import { TurnNotice } from '../turn-notice';

type Props = {
  onOpenSettings: () => void;
  onChooseMicrophone: () => void;
  lockedReason?: string;
  helpSlot?: ReactNode;
  rescueSlot?: ReactNode;
};

export function Composer({
  onOpenSettings,
  onChooseMicrophone,
  lockedReason,
  helpSlot,
  rescueSlot,
}: Props) {
  const registry = useComposerRegistry();
  const { state, draft, isSending } = useTurn();
  const interaction = useAtomValue(interactionAtom);
  const isLocked = useAtomValue(isLockedAtom);
  const isBusy = useAtomValue(isPracticeBusyAtom);
  const isAudioStage = useAtomValue(isAudioStageAtom);
  const [isTyping, setIsTyping] = useState(false);
  const isEditing = canEditDraft(state, draft.text.trim().length > 0, isTyping, interaction);
  const canTypeInstead = canOfferTypeInstead(state, isEditing, interaction);
  const label =
    interaction !== 'writing' && state.tag === 'review'
      ? 'What we heard — edit if needed'
      : 'Your answer to Eva';

  return (
    <div className="mx-auto flex w-full max-w-205 shrink-0 flex-col gap-2.5 px-6 pb-4">
      {helpSlot && <div className="max-h-44 overflow-y-auto">{helpSlot}</div>}
      <section
        aria-label="Answer composer"
        className="rounded-card border-line bg-surface shadow-overlay backdrop-blur-glass data-live:border-accent-line flex flex-col gap-3 border px-4 py-3 backdrop-saturate-170"
        data-live={state.tag === 'listening' || state.tag === 'auto-listen' || undefined}
      >
        <TurnNotice onChooseMicrophone={onChooseMicrophone} onOpenSettings={onOpenSettings} />
        {isEditing && (
          <DraftField
            isDisabled={isLocked || isBusy || isSending}
            label={label}
            onChange={(value) => changeDraft(registry, value)}
            onSend={() => sendDraft(registry)}
            shouldFocus={isTyping}
            value={draft.text}
          />
        )}
        <div className="flex flex-wrap items-center gap-3.5">
          {interaction !== 'writing' && <MicRow rescueSlot={rescueSlot} />}
          <TurnActions
            canTypeInstead={canTypeInstead}
            draft={draft.text}
            interaction={interaction}
            isEditing={isEditing}
            isSending={isSending}
            onTypeInstead={() => setIsTyping(true)}
            state={state}
          />
        </div>
        {isLocked && lockedReason && (
          <p className="text-caption text-muted leading-copy m-0" role="status">
            {lockedReason}
          </p>
        )}
      </section>
      {isAudioStage && !isEditing && (
        <div className="text-caption text-faint flex justify-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Space</Kbd>
            hold to talk
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            cancel / stop Eva
          </span>
        </div>
      )}
    </div>
  );
}
