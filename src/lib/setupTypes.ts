export type ComponentStatus = 'available' | 'missing' | 'unreadable';

export type ComponentCheck = {
  status: ComponentStatus;
  path: string | null;
  message: string;
};

export type SetupDiagnostics = {
  whisper_cli: ComponentCheck;
  whisper_model: ComponentCheck;
  /** Optional: keeps the model loaded; without it answers use one-off whisper-cli runs. */
  whisper_server: ComponentCheck;
  agy_cli: ComponentCheck;
  database_path: string;
  agy_default_model?: string;
};

function isComponentCheck(value: unknown): value is ComponentCheck {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'status' in value &&
    (value.status === 'available' || value.status === 'missing' || value.status === 'unreadable') &&
    'path' in value &&
    (typeof value.path === 'string' || value.path === null) &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

export function isSetupDiagnostics(value: unknown): value is SetupDiagnostics {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'whisper_cli' in value &&
    isComponentCheck(value.whisper_cli) &&
    'whisper_model' in value &&
    isComponentCheck(value.whisper_model) &&
    'whisper_server' in value &&
    isComponentCheck(value.whisper_server) &&
    'agy_cli' in value &&
    isComponentCheck(value.agy_cli) &&
    'database_path' in value &&
    typeof value.database_path === 'string' &&
    (!('agy_default_model' in value) ||
      (typeof value.agy_default_model === 'string' &&
        value.agy_default_model.trim().length > 0 &&
        Array.from(value.agy_default_model).length <= 120))
  );
}
