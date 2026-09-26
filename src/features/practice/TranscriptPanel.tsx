import { Chip } from '@heroui/react';

type Props = { transcript?: string };

export function TranscriptPanel({ transcript }: Props) {
  return (
    <div className="transcript-card">
      <div className="prompt-card-header">
        <div>
          <p className="section-kicker">LOCAL TRANSCRIPTION</p>
          <h3 className="text-base font-semibold text-zinc-100">Your spoken words</h3>
        </div>
        <Chip color={transcript ? 'success' : 'default'} size="sm" variant="soft">
          {transcript ? 'READY' : 'WAITING'}
        </Chip>
      </div>

      <div>
        {transcript ? (
          <p className="transcript-quote" aria-live="polite">
            “{transcript}”
          </p>
        ) : (
          <p className="transcript-empty">
            Your transcript will appear here after you speak. Local Whisper processes your words
            privately on Metal GPU.
          </p>
        )}
      </div>
    </div>
  );
}
