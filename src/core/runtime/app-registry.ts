import { scheduleTask } from '@effect/atom-react';
import { AtomRegistry } from 'effect/reactivity';

export const appRegistry = AtomRegistry.make({ scheduleTask, defaultIdleTTL: 400 });
