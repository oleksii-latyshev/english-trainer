import { expect, it } from 'bun:test';
import { DEFAULT_EVA_LOOK } from '../../palette';
import { evaLookCssVars } from '.';

it('exposes the colours Eva reads as custom properties', () => {
  const vars = evaLookCssVars(DEFAULT_EVA_LOOK);
  expect(vars['--eva-body-hi']).toBe('#FFFFFF');
  expect(vars['--eva-ink']).toBe('#22304F');
  expect(vars['--eva-leaf-dark']).toBe('#6FC08C');
  expect(vars['--eva-petal']).toBe('#FF9EC0');
});

it('follows the chosen look', () => {
  const vars = evaLookCssVars({ ...DEFAULT_EVA_LOOK, body: 'graphite', ink: 'moonlight' });
  expect(vars['--eva-body-edge']).toBe('#3E4557');
  expect(vars['--eva-ink']).toBe('#EEF3FF');
});
