import { Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { SPEECH_RATE_OPTIONS } from '@/core/voice-preference';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { RadioList } from '@/shared/ui/radio-list';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { VOICE_OPTIONS, voiceIdFromOption } from '../../helpers/voice-options';
import { useNaturalVoicePicker } from '../../model/use-natural-voice-picker';

type Props = { systemVoices: ReactNode };

const ENGINE_OPTIONS = [
  { value: 'natural', label: 'Natural' },
  { value: 'system', label: 'System' },
] as const;

const RATE_OPTIONS = SPEECH_RATE_OPTIONS.map((rate) => ({
  value: rate,
  label: `${rate.toFixed(1)}×`,
}));

export function VoiceSettings({ systemVoices }: Props) {
  const picker = useNaturalVoicePicker();
  const { natural, availability, previewing } = picker;
  const isNaturalListShown = natural.engine === 'natural' && availability === 'ready';

  return (
    <GroupCard id="voice" title="Voice">
      <FormRow
        description="Natural speech runs on this Mac. A system voice keeps replies moving if it is unavailable or slow."
        title="Voice engine"
      >
        <SegmentedControl
          label="Voice engine"
          onChange={picker.setEngine}
          options={ENGINE_OPTIONS}
          value={natural.engine}
        />
      </FormRow>
      {natural.engine === 'natural' && availability !== 'ready' && (
        <Notice role="status">
          {availability === 'loading'
            ? 'Preparing local voice. System speech is available meanwhile.'
            : 'Local voice is unavailable. Using system speech.'}
          {availability === 'unavailable' && (
            <Button onClick={picker.retry} tone="ghost">
              Retry local voice
            </Button>
          )}
        </Notice>
      )}
      {isNaturalListShown ? (
        <>
          <FormRow
            description="English neural voices, generated locally. Choosing one plays a short sample."
            title="Eva's voice"
          />
          <RadioList
            label="Eva's voice"
            onChange={picker.selectVoice}
            options={VOICE_OPTIONS}
            renderAction={(option) => (
              <Button
                aria-label={
                  previewing === voiceIdFromOption(option.value)
                    ? `Stop ${option.label} sample`
                    : `Play ${option.label} sample`
                }
                iconOnly
                onClick={() => picker.togglePreview(option.value)}
                size="sm"
                tone="quiet"
              >
                {previewing === voiceIdFromOption(option.value) ? <Pause /> : <Play />}
              </Button>
            )}
            value={String(natural.voiceId)}
          />
        </>
      ) : (
        systemVoices
      )}
      <FormRow title="Speed">
        <SegmentedControl
          label="Speed"
          onChange={picker.setRate}
          options={RATE_OPTIONS}
          value={SPEECH_RATE_OPTIONS.find((rate) => rate === picker.rate)}
        />
      </FormRow>
      {picker.previewFailed && (
        <Notice role="alert" tone="error">
          The sample could not play. Try again, or choose a system voice.
        </Notice>
      )}
    </GroupCard>
  );
}
