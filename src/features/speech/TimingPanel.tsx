import { Card } from '@heroui/react';

export type SpeechTiming = {
  captureFinalizationMs?: number;
  sttMs?: number;
  ttsStartMs?: number;
};

type Props = { timing: SpeechTiming };

function formatTiming(value?: number): string {
  return value === undefined ? '—' : `${Math.round(value)} ms`;
}

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
            <dt>Voice start</dt>
            <dd>{formatTiming(timing.ttsStartMs)}</dd>
          </div>
        </dl>
        <p className="timing-note">
          Measured on this device for the current recording. Voice start is the delay until the
          system reports that speech has begun.
        </p>
      </Card.Content>
    </Card>
  );
}
