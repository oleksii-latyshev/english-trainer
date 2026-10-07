import { Card } from '@heroui/react';
import {
  AUTO_SEND_DELAY_RANGE_MS,
  END_PAUSE_RANGE_MS,
  useConversationFlow,
} from '@/lib/conversationFlowPreferences';

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-xs text-zinc-300">
      <input
        checked={checked}
        className="mt-0.5"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-zinc-100">{label}</span>
        <span className="text-zinc-400">{hint}</span>
      </span>
    </label>
  );
}

export function ConversationFlowSettings() {
  const { preferences, update } = useConversationFlow();
  return (
    <Card className="border border-white/[0.08] bg-[#161619] p-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Conversation flow</h2>
        <p className="mt-1 text-xs text-zinc-400">
          How a spoken conversation moves from one turn to the next. Press Esc to cancel listening.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <Toggle
          checked={preferences.autoListen}
          hint="When Eva finishes speaking, listening starts by itself."
          label="Listen automatically after Eva speaks"
          onChange={(autoListen) => update({ autoListen })}
        />
        <Toggle
          checked={preferences.handsFree}
          hint="Recording stops after a pause in your speech. Use Keep listening to think."
          label="End my turn after a pause"
          onChange={(handsFree) => update({ handsFree })}
        />
        <label className="flex flex-col gap-2 text-xs text-zinc-300">
          Pause that ends a turn: {(preferences.endPauseMs / 1000).toFixed(1)} s
          <input
            disabled={!preferences.handsFree}
            max={END_PAUSE_RANGE_MS.max}
            min={END_PAUSE_RANGE_MS.min}
            onChange={(event) => update({ endPauseMs: Number(event.target.value) })}
            step={100}
            type="range"
            value={preferences.endPauseMs}
          />
        </label>
        <Toggle
          checked={preferences.autoSendVoice}
          hint="The transcript is sent after a short window in which you can edit it."
          label="Send voice answers automatically"
          onChange={(autoSendVoice) => update({ autoSendVoice })}
        />
        <label className="flex flex-col gap-2 text-xs text-zinc-300">
          Edit window before sending: {(preferences.autoSendDelayMs / 1000).toFixed(1)} s
          <input
            disabled={!preferences.autoSendVoice}
            max={AUTO_SEND_DELAY_RANGE_MS.max}
            min={AUTO_SEND_DELAY_RANGE_MS.min}
            onChange={(event) => update({ autoSendDelayMs: Number(event.target.value) })}
            step={500}
            type="range"
            value={preferences.autoSendDelayMs}
          />
        </label>
      </div>
    </Card>
  );
}
