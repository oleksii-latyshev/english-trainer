import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { Select } from '@/shared/ui/select';
import { type SystemVoice, systemVoiceOptions } from '../../helpers/system-voice-options';

export type SystemVoicesProps = {
  readonly voices: readonly SystemVoice[];
  readonly selectedVoiceURI: string | null;
  readonly isPlaying: boolean;
  readonly hasPlaybackError: boolean;
  readonly onSelect: (voiceURI: string) => void;
  readonly onPreview: () => void;
};

export function SystemVoices({
  voices,
  selectedVoiceURI,
  isPlaying,
  hasPlaybackError,
  onSelect,
  onPreview,
}: SystemVoicesProps) {
  if (voices.length === 0)
    return (
      <Notice role="status" tone="warn">
        No system speech voices are available right now. Add an English voice in macOS System
        Settings.
      </Notice>
    );
  return (
    <>
      <FormRow
        description="Voices come from macOS; Premium and Enhanced ones sound most natural."
        title="Eva's voice"
      >
        <Select
          label="Eva's voice"
          onChange={onSelect}
          options={systemVoiceOptions(voices)}
          value={selectedVoiceURI}
        />
        <Button disabled={isPlaying} onClick={onPreview} tone="ghost">
          Preview
        </Button>
      </FormRow>
      {hasPlaybackError && (
        <Notice role="alert" tone="error">
          Voice playback is unavailable.
        </Notice>
      )}
    </>
  );
}
