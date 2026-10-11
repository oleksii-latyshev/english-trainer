import { describe, expect, it } from 'bun:test';
import { DOCK_ICONS, parseDockIcon } from './dockIcon';

describe('Dock icon preference', () => {
  it('is Eva unless another icon was chosen', () => {
    for (const value of [undefined, null, 3, [], 'light', { icon: 'rabbit' }, { icon: 1 }]) {
      expect(parseDockIcon(value)).toEqual({ icon: 'eva' });
    }
  });

  it('keeps stored dark and light choices', () => {
    expect(parseDockIcon({ icon: 'light' })).toEqual({ icon: 'light' });
    expect(parseDockIcon({ icon: 'dark' })).toEqual({ icon: 'dark' });
    expect(parseDockIcon({ icon: 'eva' })).toEqual({ icon: 'eva' });
  });

  it('offers exactly the choices Rust accepts', () => {
    expect(DOCK_ICONS.map((option) => option.value)).toEqual(['eva', 'dark', 'light']);
  });
});
