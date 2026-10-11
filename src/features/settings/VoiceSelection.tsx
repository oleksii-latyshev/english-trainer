import { useTrainer } from '@/context/TrainerContext';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
export function VoiceSelection() {
  const { speech } = useTrainer();
  const isPlaying = speech.state.tag === 'starting' || speech.state.tag === 'speaking';
  const preview = (
    <Button
      disabled={isPlaying}
      onClick={() => speech.play('Hi, I am Eva. This is how I will sound.')}
      tone="ghost"
    >
      Preview
    </Button>
  );
  if (speech.engine === 'natural' && speech.naturalAvailability === 'ready') {
    return (
      <FormRow
        title="Eva's voice"
        htmlFor="eva-natural-voice"
        description="English neural voices, generated locally. Preview to choose the one you enjoy."
      >
        <select
          className="settings-select"
          id="eva-natural-voice"
          value={`natural:${speech.naturalVoiceId}`}
          onChange={(event) => {
            const value = event.target.value;
            speech.selectVoice(value);
          }}
        >
          {speech.naturalVoices.map((voice) => (
            <option key={voice.id} value={`natural:${voice.id}`}>
              {voice.name} · {voice.description}
            </option>
          ))}
        </select>
        {preview}
      </FormRow>
    );
  }
  if (!speech.voices.length)
    return (
      <Notice role="status" tone="warn">
        No system speech voices are available right now. Add an English voice in macOS System
        Settings.
      </Notice>
    );
  return (
    <FormRow
      description="Voices come from macOS; Premium and Enhanced ones sound most natural."
      htmlFor="eva-voice"
      title="Eva's voice"
    >
      <select
        className="settings-select"
        id="eva-voice"
        value={speech.selectedVoiceURI ?? ''}
        onChange={(event) => {
          const value = event.target.value;
          speech.selectVoice(value);
        }}
      >
        {speech.voices.map(({ voice, isEnglish }) => (
          <option key={voice.voiceURI} value={voice.voiceURI}>
            {voice.name} ({voice.lang}){isEnglish ? '' : ' · not English'}
          </option>
        ))}
      </select>
      {preview}
    </FormRow>
  );
}
