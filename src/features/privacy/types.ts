import type { IpcDecodeError, IpcError } from '@/core/ipc';

export type PrivacyFailure = IpcError | IpcDecodeError;

export type KeptRecordings = { readonly count: number; readonly size_bytes: number };

export type Retention = { readonly keepsAudio: boolean; readonly kept: KeptRecordings };

export type PrivacyAction = 'save' | 'delete';
