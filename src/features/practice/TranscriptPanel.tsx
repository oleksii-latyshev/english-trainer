import { Card } from '@heroui/react';

type Props = { transcript?: string };

export function TranscriptPanel({ transcript }: Props) {
  return (
    <Card className="panel transcript-panel" variant="secondary">
      <Card.Header className="panel-header">
        <div>
          <p className="section-kicker">YOUR WORDS</p>
          <Card.Title className="section-title">Transcript</Card.Title>
        </div>
        <span className={`result-indicator ${transcript ? 'result-indicator--ready' : ''}`}>
          {transcript ? 'READY' : 'WAITING'}
        </span>
      </Card.Header>
      <Card.Content className="panel-content">
        {transcript ? (
          <p className="transcript-text" aria-live="polite">
            “{transcript}”
          </p>
        ) : (
          <p className="empty-transcript">
            Your transcript will appear here after you record and transcribe a short answer.
          </p>
        )}
      </Card.Content>
    </Card>
  );
}
