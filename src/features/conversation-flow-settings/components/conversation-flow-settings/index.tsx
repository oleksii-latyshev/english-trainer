import { useAtom } from '@effect/atom-react';
import { autoSendChoice, autoSendPatch, conversationFlowAtom } from '@/core/conversation-flow';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { Switch } from '@/shared/ui/switch';
import { AUTO_SEND_OPTIONS, END_PAUSE_OPTIONS } from '../../helpers/flow-options';

export function ConversationFlowSettings() {
  const [flow, setFlow] = useAtom(conversationFlowAtom);
  return (
    <GroupCard id="flow" title="Conversation flow">
      <FormRow
        description="A pause ends your turn — no button needed. Esc cancels listening."
        title="Hands-free"
      >
        <Switch
          checked={flow.handsFree}
          isLabelHidden
          label="Hands-free"
          onCheckedChange={(handsFree) => setFlow({ ...flow, handsFree })}
        />
      </FormRow>
      <FormRow title="End-of-turn pause">
        <SegmentedControl
          disabled={!flow.handsFree}
          label="End-of-turn pause"
          onChange={(endPauseMs) => setFlow({ ...flow, endPauseMs })}
          options={END_PAUSE_OPTIONS}
          value={flow.endPauseMs}
        />
      </FormRow>
      <FormRow title="Listen automatically after Eva speaks">
        <Switch
          checked={flow.autoListen}
          isLabelHidden
          label="Listen automatically after Eva speaks"
          onCheckedChange={(autoListen) => setFlow({ ...flow, autoListen })}
        />
      </FormRow>
      <FormRow
        description="Uses echo cancellation. If the microphone cannot enable it, use the mic button or Esc."
        title="Interrupt Eva by voice"
      >
        <Switch
          checked={flow.voiceInterrupt}
          isLabelHidden
          label="Interrupt Eva by voice"
          onCheckedChange={(voiceInterrupt) => setFlow({ ...flow, voiceInterrupt })}
        />
      </FormRow>
      <FormRow
        description="With hands-free and auto-listen both on, answers are sent as soon as they are transcribed."
        title="Auto-send after review"
      >
        <SegmentedControl
          label="Auto-send after review"
          onChange={(choice) => setFlow({ ...flow, ...autoSendPatch(choice) })}
          options={AUTO_SEND_OPTIONS}
          value={autoSendChoice(flow)}
        />
      </FormRow>
    </GroupCard>
  );
}
