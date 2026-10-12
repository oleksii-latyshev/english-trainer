import { Layer } from 'effect';
import { Ipc, IpcBinary } from '../ipc';

export const CoreLive = Layer.mergeAll(Ipc.layer, IpcBinary.layer);
