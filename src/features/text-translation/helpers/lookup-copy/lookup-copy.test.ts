import { describe, expect, it } from 'bun:test';
import { IpcDecodeError, IpcError } from '@/core/ipc';
import { failureView, TRANSLATION_FAILED } from './index';

describe('failureView', () => {
  it('offers language preparation instead of a retry when models are missing', () => {
    const view = failureView(
      new IpcError({ code: 'download_required', message: 'Prepare languages.' }),
      TRANSLATION_FAILED,
    );
    expect(view).toEqual({
      message: 'Prepare languages.',
      needsPreparation: true,
      canRetry: false,
    });
  });

  it('offers no retry for an invalid request', () => {
    const view = failureView(
      new IpcError({ code: 'invalid_request', message: 'Too long.' }),
      TRANSLATION_FAILED,
    );
    expect(view.canRetry).toBe(false);
  });

  it('retries a helper failure with the recovery copy from Rust', () => {
    const view = failureView(
      new IpcError({ code: 'process_failed', message: 'Translation could not finish.' }),
      TRANSLATION_FAILED,
    );
    expect(view).toEqual({
      message: 'Translation could not finish.',
      needsPreparation: false,
      canRetry: true,
    });
  });

  it('falls back to the local copy when the answer cannot be decoded', () => {
    const view = failureView(
      new IpcDecodeError({ command: 'translate_text', cause: 'bad' }),
      TRANSLATION_FAILED,
    );
    expect(view.message).toBe(TRANSLATION_FAILED);
    expect(view.canRetry).toBe(true);
  });
});
