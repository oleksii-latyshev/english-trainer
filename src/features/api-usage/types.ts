import type { ApiUsageOverviewSchema, IpcDecodeError, IpcError } from '@/core/ipc';

export type ApiUsageFailure = IpcError | IpcDecodeError;

export type ApiUsageSnapshot = {
  readonly usage: typeof ApiUsageOverviewSchema.Type;
  readonly loadedAtMs: number;
};
