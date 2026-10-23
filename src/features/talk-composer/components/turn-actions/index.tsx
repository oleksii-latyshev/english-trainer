import { useAtomValue } from '@effect/atom-react';
import { Keyboard } from 'lucide-react';
import { cancelListening, holdListening } from '@/core/answer-capture';
import { Button } from '@/shared/ui/button';
import { Kbd } from '@/shared/ui/kbd';
import type { ComposerInteraction } from '../../helpers/composer-draft';
import type { TurnState } from '../../helpers/turn-state';
import { sendDraft, startAnswer, stopEva } from '../../model/commands';
import { useComposerRegistry } from '../../model/use-composer';
import { flowSignalsAtom, isLockedAtom, isPracticeBusyAtom } from '../../model/view-atoms';

type Props = {
  state: TurnState;
  interaction: ComposerInteraction;
  draft: string;
  isSending: boolean;
  isEditing: boolean;
  canTypeInstead: boolean;
  onTypeInstead: () => void;
};

type ListeningState = Extract<TurnState, { tag: 'listening' | 'auto-listen' }>;

function ListeningActions({ state }: { state: ListeningState }) {
  const registry = useComposerRegistry();
  const { isHandsFree } = useAtomValue(flowSignalsAtom);
  return (
    <>
      {isHandsFree && (
        <Button
          aria-pressed={state.isHeld}
          onClick={() => holdListening(registry, !state.isHeld)}
          size="sm"
          tone="secondary"
        >
          {state.isHeld ? 'Done thinking' : 'Keep listening'}
        </Button>
      )}
      <Button onClick={() => cancelListening(registry)} size="sm" tone="quiet">
        <Kbd>Esc</Kbd>
        Cancel
      </Button>
    </>
  );
}

function sendLabel(state: TurnState, isSending: boolean): string {
  if (isSending) return 'Sending…';
  return state.tag === 'review' && state.sendingLabel ? 'Send now' : 'Send';
}

function EditingActions({ state, interaction, draft, isSending }: Props) {
  const registry = useComposerRegistry();
  const isLocked = useAtomValue(isLockedAtom);
  const isBusy = useAtomValue(isPracticeBusyAtom);
  const isUnavailable = isLocked || isBusy;
  return (
    <>
      {state.tag !== 'idle' && interaction !== 'writing' && (
        <Button
          disabled={isUnavailable}
          onClick={() => startAnswer(registry)}
          size="sm"
          tone="quiet"
        >
          Re-record
        </Button>
      )}
      <Button
        disabled={!draft.trim() || isSending || isUnavailable}
        onClick={() => sendDraft(registry)}
        size="sm"
        tone="primary"
      >
        {sendLabel(state, isSending)}
        <Kbd aria-hidden="true">⌘↩</Kbd>
      </Button>
    </>
  );
}

export function TurnActions(props: Props) {
  const registry = useComposerRegistry();
  const { state, interaction, isEditing, canTypeInstead, onTypeInstead } = props;
  const isLocked = useAtomValue(isLockedAtom);
  const isBusy = useAtomValue(isPracticeBusyAtom);
  const isUnavailable = isLocked || isBusy;
  const listening = state.tag === 'listening' || state.tag === 'auto-listen' ? state : null;
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {listening && interaction !== 'writing' && <ListeningActions state={listening} />}
      {isEditing && <EditingActions {...props} />}
      {interaction !== 'writing' && state.tag === 'speaking' && (
        <Button onClick={() => stopEva(registry)} size="sm" tone="quiet">
          <Kbd>Esc</Kbd>
          Stop Eva
        </Button>
      )}
      {canTypeInstead && (
        <Button disabled={isUnavailable} onClick={onTypeInstead} size="sm" tone="quiet">
          <Keyboard aria-hidden="true" />
          Type instead
        </Button>
      )}
    </div>
  );
}
