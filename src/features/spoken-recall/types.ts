import type {
  DailyRecallPlanSchema,
  IpcDecodeError,
  IpcError,
  SpokenRecallResultSchema,
} from '@/core/ipc';
import type { TranscriptionRecovery } from '@/core/speech';

export type DailyRecallPlan = typeof DailyRecallPlanSchema.Type;

export type SpokenRecallResult = typeof SpokenRecallResultSchema.Type;

export type SpokenRecallFailure = IpcError | IpcDecodeError;

export type RecordingStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'ready' | 'error';

export type RecorderView = {
  readonly status: RecordingStatus;
  readonly error: string;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly playbackUrl: string | undefined;
  readonly transcript: string;
  readonly failure: TranscriptionRecovery | undefined;
  readonly isTranscribing: boolean;
};

export type RecallSubmission = {
  readonly phraseId: number;
  readonly transcript: string;
};
