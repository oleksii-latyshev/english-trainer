import type { EvaGrowthSchema, IpcDecodeError, IpcError } from '@/core/ipc';

export type EvaGrowthSnapshot = typeof EvaGrowthSchema.Type;

export type EvaGrowthFailure = IpcError | IpcDecodeError;
