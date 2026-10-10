import { Button, Popover } from '@heroui/react';
import { Gauge } from 'lucide-react';
import { formatTiming } from '@/lib/formatTiming';

export type SpeechTiming = {
  /** Time from the record request to audio being captured. */
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

/** The latency readout, kept one tap away from the conversation. */
export function TimingPopover({ timing }: Props) {
  if (STAGES.every((stage) => timing[stage.key] === undefined)) return null;

  return (
    <Popover>
      <Popover.Trigger>
        <Button aria-label="Speech pipeline timing" isIconOnly size="sm" variant="ghost">
          <Gauge aria-hidden="true" size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom end">
        <Popover.Dialog aria-label="Speech pipeline timing">
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
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
