import { useTrainer } from '@/context/TrainerContext';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
import { Select } from '@/shared/ui/select';

export function VoiceSelection() {
  const { speech } = useTrainer();
  const isPlaying = speech.state.tag === 'starting' || speech.state.tag === 'speaking';
  if (!speech.voices.length)
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
          onChange={speech.selectVoice}
          options={speech.voices.map(({ voice, isEnglish }) => ({
            value: voice.voiceURI,
            label: `${voice.name} (${voice.lang})${isEnglish ? '' : ' · not English'}`,
          }))}
          value={speech.selectedVoiceURI}
        />
        <Button
          disabled={isPlaying}
          onClick={() => speech.play('Hi, I am Eva. This is how I will sound.')}
          tone="ghost"
        >
          Preview
        </Button>
      </FormRow>
      {speech.state.tag === 'error' && (
        <Notice role="alert" tone="error">
          Voice playback is unavailable.
        </Notice>
      )}
    </>
  );
}
