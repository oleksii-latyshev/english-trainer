import { useTrainer } from '@/context/TrainerContext';
import { SPEECH_RATE_OPTIONS } from '@/features/speech/voicePreferences';
import { SettingsBlock } from '@/shared/ui/settings-block';
import { SettingsButton } from '@/shared/ui/settings-button';
import { SettingsRow } from '@/shared/ui/settings-row';
import { SegmentedControl } from './SettingsControls';
import { SettingsGroup } from './SettingsGroup';
import { VoiceSelection } from './VoiceSelection';

const RATE_OPTIONS = SPEECH_RATE_OPTIONS.map((rate) => ({
  value: rate,
  label: `${rate.toFixed(1)}×`,
}));

export function VoiceSettings() {
  const { speech } = useTrainer();

  return (
    <SettingsGroup id="voice" title="Voice">
      <SettingsRow
        title="Voice engine"
        description="Natural speech runs on this Mac. A system voice keeps replies moving if it is unavailable or slow."
      >
        <SegmentedControl
          label="Voice engine"
          value={speech.engine}
          onChange={speech.setEngine}
          options={[
            { value: 'natural', label: 'Natural' },
            { value: 'system', label: 'System' },
          ]}
        />
      </SettingsRow>
      {speech.engine === 'natural' && speech.naturalAvailability !== 'ready' && (
        <SettingsBlock role="status">
          {speech.naturalAvailability === 'loading'
            ? 'Preparing local voice. System speech is available meanwhile.'
            : 'Local voice is unavailable. Using system speech.'}
          {speech.naturalAvailability === 'unavailable' && (
            <SettingsButton onClick={speech.retryNaturalVoice} variant="ghost">
              Retry local voice
            </SettingsButton>
          )}
        </SettingsBlock>
      )}
      <VoiceSelection />
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
