import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from '@effect/atom-react';
import { AsyncResult, Atom } from 'effect/reactivity';
import { Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  naturalVoiceAtom,
  SPEECH_RATE_OPTIONS,
  speechVoiceAtom,
  type VoiceEngineChoice,
} from '@/core/voice-preference';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { RadioList } from '@/shared/ui/radio-list';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { naturalAvailability } from '../../helpers/natural-availability';
import { VOICE_OPTIONS, voiceIdFromOption } from '../../helpers/voice-options';
import {
  naturalVoiceAvailabilityAtom,
  previewingVoiceAtom,
  previewVoiceAtom,
} from '../../model/atoms';

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
  const [natural, setNatural] = useAtom(naturalVoiceAtom);
  const [speech, setSpeech] = useAtom(speechVoiceAtom);
  const availability = naturalAvailability(useAtomValue(naturalVoiceAvailabilityAtom));
  const retry = useAtomRefresh(naturalVoiceAvailabilityAtom);
  const preview = useAtomSet(previewVoiceAtom);
  const previewResult = useAtomValue(previewVoiceAtom);
  const previewing = useAtomValue(previewingVoiceAtom);
  const isNaturalListShown = natural.engine === 'natural' && availability === 'ready';

  function setEngine(engine: VoiceEngineChoice) {
    preview(Atom.Interrupt);
    setNatural({ ...natural, engine });
  }

  function selectVoice(value: string) {
    const voiceId = voiceIdFromOption(value);
    if (voiceId === undefined) return;
    setNatural({ engine: 'natural', voiceId });
    preview(voiceId);
  }

  function togglePreview(value: string) {
    const voiceId = voiceIdFromOption(value);
    if (voiceId === undefined) return;
    preview(previewing === voiceId ? Atom.Interrupt : voiceId);
  }

  return (
    <GroupCard id="voice" title="Voice">
      <FormRow
        description="Natural speech runs on this Mac. A system voice keeps replies moving if it is unavailable or slow."
        title="Voice engine"
      >
        <SegmentedControl
          label="Voice engine"
          onChange={setEngine}
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
            <Button onClick={retry} tone="ghost">
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
            onChange={selectVoice}
            options={VOICE_OPTIONS}
            renderAction={(option) => (
              <Button
                aria-label={
                  previewing === voiceIdFromOption(option.value)
                    ? `Stop ${option.label} sample`
                    : `Play ${option.label} sample`
                }
                iconOnly
                onClick={() => togglePreview(option.value)}
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
          onChange={(rate) => setSpeech({ ...speech, rate })}
          options={RATE_OPTIONS}
          value={SPEECH_RATE_OPTIONS.find((rate) => rate === speech.rate)}
        />
      </FormRow>
      {AsyncResult.isFailure(previewResult) && (
        <Notice role="alert" tone="error">
          The sample could not play. Try again, or choose a system voice.
        </Notice>
      )}
    </GroupCard>
  );
}
