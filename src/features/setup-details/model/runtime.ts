import { Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import { CoreLive } from '@/core/runtime';
import { SetupDiagnosticsService } from '../services/setup-diagnostics-service';

export const runtime = Atom.runtime(SetupDiagnosticsService.layer.pipe(Layer.provide(CoreLive)));
