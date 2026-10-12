import { describe, expect, it } from 'bun:test';
import { formatRecordingsSize, keepRawAudioText, keptRecordingsText } from './index';

describe('recordings text', () => {
  it('formats sizes in whole megabytes, then gigabytes', () => {
    expect(formatRecordingsSize(148 * 1024 * 1024)).toBe('148 MB');
    expect(formatRecordingsSize(10)).toBe('1 MB');
    expect(formatRecordingsSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
  });

  it('says plainly when nothing is kept', () => {
    expect(keptRecordingsText({ count: 0, size_bytes: 0 })).toBe('No recordings are kept.');
  });

  it('counts kept recordings with the right noun', () => {
    expect(keptRecordingsText({ count: 1, size_bytes: 5 * 1024 * 1024 })).toBe(
      '1 recording kept, 5 MB, in the recordings folder of the app data.',
    );
    expect(keptRecordingsText({ count: 3, size_bytes: 5 * 1024 * 1024 })).toContain(
      '3 recordings kept',
    );
  });

  it('explains what the switch does in each position', () => {
    expect(keepRawAudioText(false)).toStartWith('Off:');
    expect(keepRawAudioText(true)).toStartWith('On:');
  });
});
