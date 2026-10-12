import { Data } from 'effect';
import type { IpcDecodeError, IpcError } from '@/core/ipc';

export class VoicePlaybackError extends Data.TaggedError('VoicePlaybackError') {}

export type VoicePreviewFailure = IpcError | IpcDecodeError | VoicePlaybackError;

export type NaturalAvailability = 'loading' | 'ready' | 'unavailable';
