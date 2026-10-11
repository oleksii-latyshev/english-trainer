import { expect, it } from 'bun:test';
import { keyFieldControls } from '.';

const SAVED = { configured: true, source: 'settings' } as const;
const FROM_ENV = { configured: true, source: 'environment' } as const;
const NONE = { configured: false, source: null } as const;

it('lets the learner save only a non-blank draft while idle', () => {
  expect(keyFieldControls({ draft: 'AIza', isBusy: false, status: NONE }).canSave).toBe(true);
  expect(keyFieldControls({ draft: '   ', isBusy: false, status: NONE }).canSave).toBe(false);
  expect(keyFieldControls({ draft: 'AIza', isBusy: true, status: NONE }).canSave).toBe(false);
});

it('lets the learner remove only a key saved in Settings', () => {
  expect(keyFieldControls({ draft: '', isBusy: false, status: SAVED }).canRemove).toBe(true);
  expect(keyFieldControls({ draft: '', isBusy: false, status: FROM_ENV }).canRemove).toBe(false);
  expect(keyFieldControls({ draft: '', isBusy: false, status: NONE }).canRemove).toBe(false);
  expect(keyFieldControls({ draft: '', isBusy: false, status: null }).canRemove).toBe(false);
  expect(keyFieldControls({ draft: '', isBusy: true, status: SAVED }).canRemove).toBe(false);
});

it('masks the placeholder once a key exists', () => {
  expect(keyFieldControls({ draft: '', isBusy: false, status: SAVED }).placeholder).toBe(
    '••••••••••••••••',
  );
  expect(keyFieldControls({ draft: '', isBusy: false, status: null }).placeholder).toBe(
    'Paste your key',
  );
});
