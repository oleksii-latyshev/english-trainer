import { Atom } from 'effect/reactivity';
import { AppearanceSchema } from '../helpers/appearance-schema';
import { DEFAULT_APPEARANCE } from '../theme';
import { appearanceRuntime } from './runtime';

const APPEARANCE_KEY = 'english_trainer_appearance';

export const appearanceAtom = Atom.kvs({
  runtime: appearanceRuntime,
  key: APPEARANCE_KEY,
  schema: AppearanceSchema,
  defaultValue: () => DEFAULT_APPEARANCE,
  mode: 'sync',
});
