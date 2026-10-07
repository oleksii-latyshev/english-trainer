import { formatTiming } from '@/lib/formatTiming';

export type SpeechTiming = {
  /** Time from the record request to audio being captured. */
  captureStartMs?: number;
  captureFinalizationMs?: number;
  sttMs?: number;
  ttsStartMs?: number;
};

type Props = { timing: SpeechTiming };

export function TimingPanel({ timing }: Props) {
  if (
    timing.captureStartMs === undefined &&
    timing.captureFinalizationMs === undefined &&
    timing.sttMs === undefined &&
    timing.ttsStartMs === undefined
  )
    return null;

  return (
    <div className="prompt-card">
      <div className="prompt-card-header">
        <div>
          <p className="section-kicker">LOCAL TELEMETRY</p>
          <h3 className="text-base font-semibold text-zinc-100">Speech Pipeline Latency</h3>
        </div>
      </div>
      <dl className="timing-grid-codex" aria-label="Speech pipeline timing">
        <div className="timing-stat-box">
          <dt>Mic Start</dt>
          <dd>{formatTiming(timing.captureStartMs)}</dd>
        </div>
        <div className="timing-stat-box">
          <dt>Audio Buffer</dt>
          <dd>{formatTiming(timing.captureFinalizationMs)}</dd>
        </div>
        <div className="timing-stat-box">
          <dt>Whisper STT</dt>
          <dd>{formatTiming(timing.sttMs)}</dd>
        </div>
        <div className="timing-stat-box">
          <dt>System Voice</dt>
          <dd>{formatTiming(timing.ttsStartMs)}</dd>
        </div>
      </dl>
      <p className="m-0 text-xs text-zinc-500">
        Measured locally on this device via macOS Metal GPU. Raw audio is discarded after
        transcription.
      </p>
    </div>
  );
}
