import { Switch } from '@heroui/react';
import { Eva, type EvaMood } from '@/components/eva/Eva';
import {
  type ConversationFlowPreferences,
  END_PAUSE_RANGE_MS,
} from '@/lib/conversationFlowPreferences';
import type { TurnPresentation } from './lib/turnState';

const PAUSE_PRESETS_MS = [1000, 1500, 2000, 3000];

type Props = {
  mood: EvaMood;
  presentation: TurnPresentation;
  flow: ConversationFlowPreferences;
  onFlowChange: (patch: Partial<ConversationFlowPreferences>) => void;
  /** Sending voice answers automatically is locked while the composer is. */
  isSendLocked: boolean;
  inputLabel?: string;
};

function FlowSwitch({
  label,
  isSelected,
  isDisabled = false,
  onChange,
}: {
  label: string;
  isSelected: boolean;
  isDisabled?: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    <Switch
      className="talk-switch"
      isDisabled={isDisabled}
      isSelected={isSelected}
      onChange={onChange}
    >
      <Switch.Content>{label}</Switch.Content>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

function pauseChoices(currentMs: number): number[] {
  const inRange = PAUSE_PRESETS_MS.filter(
    (ms) => ms >= END_PAUSE_RANGE_MS.min && ms <= END_PAUSE_RANGE_MS.max,
  );
  return inRange.includes(currentMs) ? inRange : [...inRange, currentMs].sort((a, b) => a - b);
}

function PauseChoice({
  flow,
  onChange,
}: {
  flow: ConversationFlowPreferences;
  onChange: (endPauseMs: number) => void;
}) {
  return (
    <fieldset className="talk-flow-row talk-seg-group">
      <legend>End-of-turn pause</legend>
      <div className="talk-seg">
        {pauseChoices(flow.endPauseMs).map((ms) => (
          <label key={ms}>
            <input
              checked={flow.endPauseMs === ms}
              disabled={!flow.handsFree}
              name="talk-end-pause"
              onChange={() => onChange(ms)}
              type="radio"
            />
            <span>{`${Number((ms / 1000).toFixed(1))} s`}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Eva at stage size with the turn label, and the conversation-flow switches within reach. */
export function EvaStage({
  mood,
  presentation,
  flow,
  onFlowChange,
  isSendLocked,
  inputLabel,
}: Props) {
  return (
    <aside aria-label="Eva" className="talk-stage">
      <Eva label={`Eva, ${presentation.stageTitle.toLowerCase()}`} mood={mood} size={184} />
      <div className="talk-stage-copy" role="status">
        <span className="talk-stage-actor" data-actor={presentation.actor}>
          {presentation.stageLabel}
        </span>
        <h2 className="talk-stage-title">{presentation.stageTitle}</h2>
        <p className="talk-stage-hint">{presentation.stageHint}</p>
      </div>
      <section aria-label="Conversation flow" className="talk-flow">
        <div className="talk-flow-title">Conversation flow</div>
        <FlowSwitch
          isSelected={flow.handsFree}
          label="Hands-free"
          onChange={(handsFree) => onFlowChange({ handsFree })}
        />
        <PauseChoice flow={flow} onChange={(endPauseMs) => onFlowChange({ endPauseMs })} />
        <FlowSwitch
          isSelected={flow.autoListen}
          label="Listen after Eva speaks"
          onChange={(autoListen) => onFlowChange({ autoListen })}
        />
        <FlowSwitch
          isDisabled={isSendLocked}
          isSelected={flow.autoSendVoice}
          label="Send voice answers"
          onChange={(autoSendVoice) => onFlowChange({ autoSendVoice })}
        />
        {inputLabel && <div className="talk-flow-input">Microphone: {inputLabel}</div>}
      </section>
    </aside>
  );
}
