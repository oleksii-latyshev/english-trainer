import { Card } from '@heroui/react';
import { formatTiming } from '@/lib/formatTiming';

export type SpeechTiming = {
  captureFinalizationMs?: number;
  sttMs?: number;
  ttsStartMs?: number;
};

type Props = { timing: SpeechTiming };

export function TimingPanel({ timing }: Props) {
  if (
    timing.captureFinalizationMs === undefined &&
    timing.sttMs === undefined &&
    timing.ttsStartMs === undefined
  )
    return null;

  return (
    <Card className="panel timing-panel" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">LOCAL DIAGNOSTICS</p>
          <Card.Title className="section-title">Last take timing</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="panel-content">
        <dl className="timing-grid" aria-label="Speech pipeline timing">
          <div>
            <dt>Prepare audio</dt>
            <dd>{formatTiming(timing.captureFinalizationMs)}</dd>
          </div>
          <div>
            <dt>Transcribe</dt>
            <dd>{formatTiming(timing.sttMs)}</dd>
          </div>
          <div>
            <dt>Transcript voice</dt>
            <dd>{formatTiming(timing.ttsStartMs)}</dd>
          </div>
        </dl>
        <p className="timing-note">
          Measured on this device for the current recording. Transcript voice is the delay before
          the system starts reading your own words back.
        </p>
      </Card.Content>
    </Card>
  );
}
