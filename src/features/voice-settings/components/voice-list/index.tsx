import { Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { SPEECH_RATE_OPTIONS } from '@/core/voice-preference';
import { Button } from '@/shared/ui/button';
import { ChoiceList } from '@/shared/ui/choice-list';
import { ListGroup, ListRow } from '@/shared/ui/list-group';
import { Notice } from '@/shared/ui/notice';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { VOICE_OPTIONS, voiceIdFromOption } from '../../helpers/voice-options';
import { useNaturalVoicePicker } from '../../model/use-natural-voice-picker';

const RATE_OPTIONS = SPEECH_RATE_OPTIONS.map((rate) => ({
  value: rate,
  label: `${rate.toFixed(1)}×`,
}));

const CHOICES = VOICE_OPTIONS.map((option) => ({
  value: option.value,
  title: option.label,
  subtitle: option.description,
}));

type Props = { systemVoices: ReactNode };

export function VoiceList({ systemVoices }: Props) {
  const picker = useNaturalVoicePicker();
  const { natural, availability, previewing } = picker;
  const selected = natural.engine === 'natural' ? String(natural.voiceId) : null;

  return (
    <div className="flex flex-col gap-6">
      {availability === 'ready' ? (
        <ChoiceList
          label="Voice"
          onChange={picker.selectVoice}
          options={CHOICES}
          renderLeading={(option) => {
            const isPlaying = previewing === voiceIdFromOption(option.value);
            return (
              <Button
                aria-label={`${isPlaying ? 'Stop' : 'Play'} ${option.title} sample`}
                iconOnly
                onClick={() => picker.togglePreview(option.value)}
                size="sm"
                tone={option.value === selected ? 'primary' : 'quiet'}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
            );
          }}
          value={selected}
        />
      ) : (
        <>
          <Notice role="status">
            {availability === 'loading'
              ? 'Preparing the local voice…'
              : 'The local voice is unavailable. Choose a system voice instead.'}
            {availability === 'unavailable' && (
              <Button onClick={picker.retry} tone="ghost">
                Retry local voice
              </Button>
            )}
          </Notice>
          <ListGroup>{systemVoices}</ListGroup>
        </>
      )}
      <ListGroup>
        <ListRow
          title="Speed"
          trailing={
            <SegmentedControl
              label="Speed"
              onChange={picker.setRate}
              options={RATE_OPTIONS}
              value={SPEECH_RATE_OPTIONS.find((rate) => rate === picker.rate)}
            />
          }
        />
      </ListGroup>
      {picker.previewFailed && (
        <Notice role="alert" tone="error">
          The sample could not play. Try again.
        </Notice>
      )}
    </div>
  );
}
