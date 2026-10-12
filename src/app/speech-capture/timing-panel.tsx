import { Gauge } from 'lucide-react';
import { formatTiming } from '@/lib/formatTiming';
import { Button } from '@/shared/ui/button';
import { Popover } from '@/shared/ui/popover';

export type SpeechTiming = {
  captureStartMs?: number;
  captureFinalizationMs?: number;
  sttMs?: number;
  ttsStartMs?: number;
  firstTokenMs?: number;
  providerCompleteMs?: number;
  sendToAudioMs?: number;
  firstAiAudioMs?: number;
};

type Props = { timing: SpeechTiming };

const STAGES: { label: string; key: keyof SpeechTiming }[] = [
  { label: 'Mic start', key: 'captureStartMs' },
  { label: 'Audio buffer', key: 'captureFinalizationMs' },
  { label: 'Whisper STT', key: 'sttMs' },
  { label: 'System voice', key: 'ttsStartMs' },
  { label: 'AI first text', key: 'firstTokenMs' },
  { label: 'AI complete reply', key: 'providerCompleteMs' },
  { label: 'Send to first audio', key: 'sendToAudioMs' },
  { label: 'Speech end to first AI audio', key: 'firstAiAudioMs' },
];

export function TimingPopover({ timing }: Props) {
  if (STAGES.every((stage) => timing[stage.key] === undefined)) return null;

  return (
    <Popover
      align="end"
      label="Speech pipeline timing"
      trigger={
        <Button aria-label="Speech pipeline timing" iconOnly size="sm" tone="quiet">
          <Gauge aria-hidden="true" size={16} />
        </Button>
      }
    >
      <div className="talk-timing">
        <h3 className="talk-timing-title">Speech pipeline latency</h3>
        <dl>
          {STAGES.map((stage) => (
            <div key={stage.key}>
              <dt>{stage.label}</dt>
              <dd>{formatTiming(timing[stage.key])}</dd>
            </div>
          ))}
        </dl>
        <p>Measured locally on this device. Raw audio is discarded after transcription.</p>
      </div>
    </Popover>
  );
}
