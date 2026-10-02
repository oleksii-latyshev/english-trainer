import { describe, expect, it } from 'bun:test';
import { isSetupDiagnostics } from './setupTypes';

const diagnostics = {
  whisper_cli: { status: 'available', path: '/usr/local/bin/whisper', message: 'Found.' },
  whisper_model: { status: 'missing', path: null, message: 'Model is missing.' },
  agy_cli: { status: 'unreadable', path: '/usr/local/bin/agy', message: 'Cannot read file.' },
  database_path: '/tmp/english-trainer.sqlite',
};

describe('setup diagnostics payload', () => {
  it('accepts the complete diagnostics DTO', () => {
    expect(isSetupDiagnostics(diagnostics)).toBe(true);
  });

  it('rejects missing fields and malformed component checks', () => {
    expect(isSetupDiagnostics({ ...diagnostics, agy_cli: undefined })).toBe(false);
    expect(
      isSetupDiagnostics({
        ...diagnostics,
        whisper_model: { ...diagnostics.whisper_model, status: 'installed' },
      }),
    ).toBe(false);
    expect(isSetupDiagnostics(null)).toBe(false);
  });
});
