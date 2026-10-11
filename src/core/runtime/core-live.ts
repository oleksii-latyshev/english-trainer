import { Layer } from 'effect';
import { Ipc } from '../ipc';

export const CoreLive = Layer.mergeAll(Ipc.layer);
