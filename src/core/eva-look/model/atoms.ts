import { Atom } from 'effect/reactivity';
import { EvaFoldedSchema } from '../helpers/eva-fold-schema';
import { EvaLookSchema } from '../helpers/eva-look-schema';
import { DEFAULT_EVA_LOOK } from '../palette';
import { evaLookRuntime } from './runtime';

const EVA_LOOK_KEY = 'english_trainer_eva_look';

export const evaLookAtom = Atom.kvs({
  runtime: evaLookRuntime,
  key: EVA_LOOK_KEY,
  schema: EvaLookSchema,
  defaultValue: () => DEFAULT_EVA_LOOK,
  mode: 'sync',
});

const EVA_FOLDED_KEY = 'english_trainer_eva_folded';

export const evaFoldedAtom = Atom.kvs({
  runtime: evaLookRuntime,
  key: EVA_FOLDED_KEY,
  schema: EvaFoldedSchema,
  defaultValue: () => false,
  mode: 'sync',
});
