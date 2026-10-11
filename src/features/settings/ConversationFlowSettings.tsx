import {
  AUTO_SEND_CHOICES_MS,
  autoSendChoice,
  autoSendPatch,
  END_PAUSE_CHOICES_MS,
  useConversationFlow,
} from '@/lib/conversationFlowPreferences';
import { FormRow } from '@/shared/ui/form-row';
import { SegmentedControl, Switch } from './SettingsControls';
import { SettingsGroup } from './SettingsGroup';

const END_PAUSE_OPTIONS = END_PAUSE_CHOICES_MS.map((ms) => ({
  value: ms,
  label: `${ms / 1000} s`,
}));

const AUTO_SEND_OPTIONS = [
  { value: 'off' as const, label: 'Off' },
  ...AUTO_SEND_CHOICES_MS.map((ms) => ({ value: ms, label: `${ms / 1000} s` })),
];

export function ConversationFlowSettings() {
  const { preferences, update } = useConversationFlow();
  return (
    <SettingsGroup id="flow" title="Conversation flow">
      <FormRow
        description="A pause ends your turn — no button needed. Esc cancels listening."
        title="Hands-free"
      >
        <Switch
          checked={preferences.handsFree}
          label="Hands-free"
          onChange={(handsFree) => update({ handsFree })}
        />
      </FormRow>
      <FormRow title="End-of-turn pause">
        <SegmentedControl
          isDisabled={!preferences.handsFree}
          label="End-of-turn pause"
          onChange={(endPauseMs) => update({ endPauseMs })}
          options={END_PAUSE_OPTIONS}
          value={preferences.endPauseMs}
        />
      </FormRow>
      <FormRow title="Listen automatically after Eva speaks">
        <Switch
          checked={preferences.autoListen}
          label="Listen automatically after Eva speaks"
          onChange={(autoListen) => update({ autoListen })}
        />
      </FormRow>
      <FormRow
        description="Uses echo cancellation. If the microphone cannot enable it, use the mic button or Esc."
        title="Interrupt Eva by voice"
      >
        <Switch
          checked={preferences.voiceInterrupt}
          label="Interrupt Eva by voice"
          onChange={(voiceInterrupt) => update({ voiceInterrupt })}
        />
      </FormRow>
      <FormRow
        description="With hands-free and auto-listen both on, answers are sent as soon as they are transcribed."
        title="Auto-send after review"
      >
        <SegmentedControl
          label="Auto-send after review"
          onChange={(choice) => update(autoSendPatch(choice))}
          options={AUTO_SEND_OPTIONS}
          value={autoSendChoice(preferences)}
        />
      </FormRow>
    </SettingsGroup>
  );
}
