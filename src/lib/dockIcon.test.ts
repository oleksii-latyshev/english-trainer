// @ts-expect-error Bun supplies this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { DOCK_ICONS, parseDockIcon } from './dockIcon';

describe('Dock icon preference', () => {
  it('is the dark icon unless the light one was chosen', () => {
    for (const value of [undefined, null, 3, [], 'light', { icon: 'rabbit' }, { icon: 1 }]) {
      expect(parseDockIcon(value)).toEqual({ icon: 'dark' });
    }
    expect(parseDockIcon({ icon: 'light' })).toEqual({ icon: 'light' });
    expect(parseDockIcon({ icon: 'dark' })).toEqual({ icon: 'dark' });
  });

  it('offers exactly the two choices Rust accepts', () => {
    expect(DOCK_ICONS.map((option) => option.value)).toEqual(['dark', 'light']);
  });
});
