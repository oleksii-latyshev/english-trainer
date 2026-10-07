import { useTrainer } from '@/context/TrainerContext';
import { SPEECH_RATE_OPTIONS } from '@/features/speech/voicePreferences';
import { SegmentedControl, SettingsButton } from './SettingsControls';
import { SettingsBlock, SettingsGroup, SettingsRow } from './SettingsGroup';

const RATE_OPTIONS = SPEECH_RATE_OPTIONS.map((rate) => ({
  value: rate,
  label: `${rate.toFixed(1)}×`,
}));

export function VoiceSettings() {
  const { speech } = useTrainer();
  const selectedVoice = speech.voices.find(
    (option) => option.voice.voiceURI === speech.selectedVoiceURI,
  );
  const isPlaying = speech.state.tag === 'starting' || speech.state.tag === 'speaking';

  return (
    <SettingsGroup id="voice" title="Voice">
      {speech.voices.length === 0 ? (
        <SettingsBlock role="status" tone="warn">
          No system speech voices are available right now. Eva's voice uses the voices installed in
          macOS.
        </SettingsBlock>
      ) : (
        <SettingsRow
          description="Voices come from macOS; Premium and Enhanced ones sound most natural."
          htmlFor="eva-voice"
          title="Eva's voice"
        >
          <select
            className="settings-select"
            id="eva-voice"
            onChange={(event) => {
              const value = event.target.value;
              speech.selectVoice(value);
            }}
            value={speech.selectedVoiceURI ?? ''}
          >
            {speech.voices.map(({ voice, isEnglish }) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang}){isEnglish ? '' : ' · not English'}
              </option>
            ))}
          </select>
          <SettingsButton
            disabled={!selectedVoice || isPlaying}
            onClick={() => speech.play('Hi, I am Eva. This is how I will sound.')}
            variant="ghost"
          >
            Preview
          </SettingsButton>
        </SettingsRow>
      )}
      <SettingsRow title="Speed">
        <SegmentedControl
          label="Speed"
          onChange={speech.setRate}
          options={RATE_OPTIONS}
          value={SPEECH_RATE_OPTIONS.find((rate) => rate === speech.rate)}
        />
      </SettingsRow>
      {speech.state.tag === 'error' && (
        <SettingsBlock role="alert" tone="error">
          Voice playback is unavailable.
        </SettingsBlock>
      )}
    </SettingsGroup>
  );
}
