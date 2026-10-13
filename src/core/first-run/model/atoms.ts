import { Atom } from 'effect/reactivity';
import { FIRST_RUN_KEY, PENDING_MARKER } from '../first-run';
import { FirstRunMarkerSchema } from '../helpers/first-run-marker-schema';
import { firstRunRuntime } from './runtime';

export const firstRunMarkerAtom = Atom.kvs({
  runtime: firstRunRuntime,
  key: FIRST_RUN_KEY,
  schema: FirstRunMarkerSchema,
  defaultValue: () => PENDING_MARKER,
  mode: 'sync',
});
