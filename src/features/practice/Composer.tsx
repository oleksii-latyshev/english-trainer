import { Button, Kbd } from '@heroui/react';
import { Keyboard } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { TurnPresentation, TurnState } from './lib/turnState';
import { LevelMeter, MicButton } from './MicControl';

type Props = {
  state: TurnState;
  presentation: TurnPresentation;
  level: number;
  isHandsFree: boolean;
  /** The composer is locked by the screen (recall or retry in progress, or a saved Coach answer). */
  isLocked: boolean;
  lockedReason?: string;
  /** Eva or the session is busy, so a new recording cannot start. */
  isBusy: boolean;
  isSending: boolean;
  draft: string;
  onChangeDraft: (value: string) => void;
  onSend: () => void;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onHold: (isHeld: boolean) => void;
  onResume: () => void;
};

type ListeningState = Extract<TurnState, { tag: 'listening' | 'auto-listen' }>;

function canEditDraft(state: TurnState, hasDraft: boolean, isTyping: boolean): boolean {
  if (state.tag === 'review') return true;
  if (state.tag === 'idle') return hasDraft || isTyping;
  return state.tag === 'error' && hasDraft;
}

function isMicDisabled(state: TurnState, isUnavailable: boolean): boolean {
  switch (state.tag) {
    case 'listening':
    case 'auto-listen':
      return !state.isLive;
    case 'transcribing':
    case 'thinking':
      return true;
    case 'paused':
      return false;
    default:
      return isUnavailable;
  }
}

function DraftField({
  label,
  value,
  isDisabled,
  shouldFocus,
  onChange,
  onSend,
}: {
  label: string;
  value: string;
  isDisabled: boolean;
  shouldFocus: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (shouldFocus) fieldRef.current?.focus();
  }, [shouldFocus]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="talk-draft">
      <label htmlFor="talk-draft">{label}</label>
      <textarea
        disabled={isDisabled}
        id="talk-draft"
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Type your answer…"
        ref={fieldRef}
        rows={2}
        value={value}
      />
    </div>
  );
}

function ListeningActions({ state, props }: { state: ListeningState; props: Props }) {
  return (
    <>
      {props.isHandsFree && (
        <Button
          aria-pressed={state.isHeld}
          onPress={() => props.onHold(!state.isHeld)}
          size="sm"
          variant="secondary"
        >
          {state.isHeld ? 'Done thinking' : 'Keep listening'}
        </Button>
      )}
      <Button onPress={props.onCancel} size="sm" variant="ghost">
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

function EditingActions({ props }: { props: Props }) {
  const { state, draft, isSending, isLocked, isBusy } = props;
  const isUnavailable = isLocked || isBusy;
  return (
    <>
      {state.tag !== 'idle' && (
        <Button isDisabled={isUnavailable} onPress={props.onStart} size="sm" variant="ghost">
          Re-record
        </Button>
      )}
      <Button
        isDisabled={!draft.trim() || isSending || isUnavailable}
        onPress={props.onSend}
        size="sm"
        variant="primary"
      >
        {sendLabel(state, isSending)}
      </Button>
    </>
  );
}

export function Composer(props: Props) {
  const { state, presentation, isLocked, lockedReason, isBusy, draft, isSending } = props;
  const [isTyping, setIsTyping] = useState(false);
  const isEditing = canEditDraft(state, draft.trim().length > 0, isTyping);
  const listening = state.tag === 'listening' || state.tag === 'auto-listen' ? state : null;

  function handlePressMic() {
    if (listening) props.onStop();
    else if (state.tag === 'paused') props.onResume();
    else props.onStart();
  }

  return (
    <section aria-label="Answer composer" className="talk-composer" data-live={listening !== null}>
      {isEditing && (
        <DraftField
          isDisabled={isLocked || isBusy || isSending}
          label={state.tag === 'review' ? 'What we heard — edit if needed' : 'Your answer to Eva'}
          onChange={props.onChangeDraft}
          onSend={props.onSend}
          shouldFocus={isTyping}
          value={draft}
        />
      )}

      <div className="talk-composer-main">
        <MicButton
          icon={presentation.micIcon}
          isDisabled={isMicDisabled(state, isLocked || isBusy)}
          name={presentation.micName}
          onPress={handlePressMic}
          variant={presentation.micVariant}
        />
        <div className="talk-mic-copy" role="status">
          <span className="talk-mic-title">
            {presentation.micTitle}
            {state.tag === 'auto-listen' && <span className="talk-auto-cue">Auto</span>}
          </span>
          <span className="talk-mic-hint">{presentation.micHint}</span>
        </div>
        {presentation.hasMeter && (
          <LevelMeter isActive={listening?.isLive === true} level={props.level} />
        )}
        <div className="talk-composer-actions">
          {listening && <ListeningActions props={props} state={listening} />}
          {isEditing && <EditingActions props={props} />}
          {state.tag === 'idle' && !isEditing && (
            <Button
              isDisabled={isLocked || isBusy}
              onPress={() => setIsTyping(true)}
              size="sm"
              variant="ghost"
            >
              <Keyboard aria-hidden="true" size={16} />
              Type instead
            </Button>
          )}
        </div>
      </div>

      {isLocked && lockedReason && (
        <p className="talk-quiet-note" role="status">
          {lockedReason}
        </p>
      )}
    </section>
  );
}
