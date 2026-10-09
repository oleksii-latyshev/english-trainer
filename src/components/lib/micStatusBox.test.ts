// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { micStatusBox } from './micStatusBox';

describe('micStatusBox', () => {
  it('is on while the warm session holds the microphone', () => {
    for (const status of ['opening', 'warming', 'ready'] as const) {
      expect(micStatusBox(status)).toMatchObject({ isOn: true, title: 'Microphone on' });
    }
  });

  it('is off when the microphone is paused, failed or not in use, and says why', () => {
    expect(micStatusBox('paused')).toEqual({
      isOn: false,
      title: 'Microphone off',
      hint: 'Released while paused.',
    });
    expect(micStatusBox('error').hint).toBe('Not available right now.');
    expect(micStatusBox('off')).toMatchObject({
      isOn: false,
      hint: 'Opens for spoken practice.',
    });
  });
});
