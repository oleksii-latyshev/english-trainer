import type { IpcDecodeError, IpcError } from '@/core/ipc';
import type { ProfileTooLong } from './errors';

export type PersonalProfileFailure = IpcError | IpcDecodeError;

export type SavePersonalProfileFailure = PersonalProfileFailure | ProfileTooLong;
