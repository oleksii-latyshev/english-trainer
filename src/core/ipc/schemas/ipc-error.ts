import { Schema } from 'effect';
import type { IpcError } from '../bindings/IpcError';
import type { IpcErrorCode } from '../bindings/IpcErrorCode';
import { bindingSchema } from './binding-schema';

const IpcErrorCodeSchema = bindingSchema<IpcErrorCode>()(
  Schema.Literals([
    'unavailable',
    'unauthorized',
    'rate_limited',
    'timeout',
    'cancelled',
    'invalid_output',
    'process_failed',
    'invalid_request',
    'busy',
    'invalid_session',
    'database_error',
    'invalid_audio',
    'no_speech',
    'model_missing',
    'engine_missing',
    'download_required',
  ]),
);

export const IPC_ERROR_FIELDS = {
  code: IpcErrorCodeSchema,
  message: Schema.String,
};

export const IpcErrorSchema = bindingSchema<IpcError>()(Schema.Struct(IPC_ERROR_FIELDS));
