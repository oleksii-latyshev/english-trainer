import { Layer } from 'effect';
import { Ipc, IpcBinary, IpcEvents } from '../ipc';

export const CoreLive = Layer.mergeAll(Ipc.layer, IpcBinary.layer, IpcEvents.layer);
