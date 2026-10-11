import { useTrainer } from '@/context/TrainerContext';
import { SPEECH_RATE_OPTIONS } from '@/features/speech/voicePreferences';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { Notice } from '@/shared/ui/notice';
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
      <FormRow
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
      </FormRow>
      {speech.engine === 'natural' && speech.naturalAvailability !== 'ready' && (
        <Notice role="status">
          {speech.naturalAvailability === 'loading'
            ? 'Preparing local voice. System speech is available meanwhile.'
            : 'Local voice is unavailable. Using system speech.'}
          {speech.naturalAvailability === 'unavailable' && (
            <Button onClick={speech.retryNaturalVoice} tone="ghost">
              Retry local voice
            </Button>
          )}
        </Notice>
      )}
      <VoiceSelection />
      <FormRow title="Speed">
        <SegmentedControl
          label="Speed"
          onChange={speech.setRate}
          options={RATE_OPTIONS}
          value={SPEECH_RATE_OPTIONS.find((rate) => rate === speech.rate)}
        />
      </FormRow>
      {speech.state.tag === 'error' && (
        <Notice role="alert" tone="error">
          Voice playback is unavailable.
        </Notice>
      )}
    </SettingsGroup>
  );
}
