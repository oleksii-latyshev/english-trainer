import { Schema } from 'effect';
import type { ComponentCheck } from '../bindings/ComponentCheck';
import type { ComponentStatus } from '../bindings/ComponentStatus';
import type { SetupDiagnostics } from '../bindings/SetupDiagnostics';
import { bindingSchema } from './binding-schema';

const ComponentStatusSchema = bindingSchema<ComponentStatus>()(
  Schema.Literals(['available', 'missing', 'unreadable']),
);

const ComponentCheckSchema = bindingSchema<ComponentCheck>()(
  Schema.Struct({
    status: ComponentStatusSchema,
    path: Schema.NullOr(Schema.String),
    message: Schema.String,
  }),
);

export const SetupDiagnosticsSchema = bindingSchema<SetupDiagnostics>()(
  Schema.Struct({
    whisper_cli: ComponentCheckSchema,
    whisper_model: ComponentCheckSchema,
    whisper_server: ComponentCheckSchema,
    agy_cli: ComponentCheckSchema,
    database_path: Schema.String,
    agy_default_model: Schema.optionalKey(Schema.String),
  }),
);
