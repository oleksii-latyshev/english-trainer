import { useAtom, useAtomValue } from '@effect/atom-react';
import { conversationFlowAtom, END_PAUSE_CHOICES_MS } from '@/core/conversation-flow';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { Switch } from '@/shared/ui/switch';
import { isLockedAtom } from '../../model/view-atoms';

function pauseOptions(currentMs: number) {
  const choices: number[] = END_PAUSE_CHOICES_MS.includes(currentMs as never)
    ? [...END_PAUSE_CHOICES_MS]
    : [...END_PAUSE_CHOICES_MS, currentMs].sort((a, b) => a - b);
  return choices.map((ms) => ({ value: ms, label: `${Number((ms / 1000).toFixed(1))} s` }));
}

export function FlowControls() {
  const [flow, setFlow] = useAtom(conversationFlowAtom);
  const isSendLocked = useAtomValue(isLockedAtom);
  return (
    <section aria-label="Conversation flow" className="flex w-72 flex-col items-stretch gap-3 p-2">
      <Switch
        checked={flow.handsFree}
        label="Hands-free"
        onCheckedChange={(handsFree) => setFlow({ ...flow, handsFree })}
      />
      <SegmentedControl
        disabled={!flow.handsFree}
        label="End-of-turn pause"
        onChange={(endPauseMs) => setFlow({ ...flow, endPauseMs })}
        options={pauseOptions(flow.endPauseMs)}
        size="sm"
        value={flow.endPauseMs}
      />
      <Switch
        checked={flow.autoListen}
        label="Listen after Eva speaks"
        onCheckedChange={(autoListen) => setFlow({ ...flow, autoListen })}
      />
      <Switch
        checked={flow.autoSendVoice}
        disabled={isSendLocked}
        label="Send voice answers"
        onCheckedChange={(autoSendVoice) => setFlow({ ...flow, autoSendVoice })}
      />
    </section>
  );
}
