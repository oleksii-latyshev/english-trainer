import type { ConversationFlowPreferences } from '@/lib/conversationFlowPreferences';

type Props = {
  actualInputLabel?: string;
  blocked: boolean;
  errorMessage?: string;
  flow: ConversationFlowPreferences;
  onFlowChange: (patch: Partial<ConversationFlowPreferences>) => void;
  transcribing: boolean;
};

export function ComposerFooter({
  actualInputLabel,
  blocked,
  errorMessage,
  flow,
  onFlowChange,
  transcribing,
}: Props) {
  return (
    <div className="composer-footer">
      {actualInputLabel && (
        <span className="text-xs text-zinc-400">Last input: {actualInputLabel}</span>
      )}
      <div className="flex items-center gap-3">
        <label className="composer-checkbox-label">
          <input
            aria-label="Hands-free: end my turn after a pause"
            checked={flow.handsFree}
            onChange={(event) => onFlowChange({ handsFree: event.target.checked })}
            type="checkbox"
          />
          <span>Hands-free</span>
        </label>
        <label className="composer-checkbox-label">
          <input
            aria-label="Send voice answers automatically"
            checked={flow.autoSendVoice}
            disabled={blocked}
            onChange={(event) => onFlowChange({ autoSendVoice: event.target.checked })}
            type="checkbox"
          />
          <span>Send voice answers automatically</span>
        </label>
        {transcribing && (
          <span className="text-xs text-purple-300 animate-pulse">Transcribing locally…</span>
        )}
      </div>
      {errorMessage && (
        <p className="error-message m-0 text-xs" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
