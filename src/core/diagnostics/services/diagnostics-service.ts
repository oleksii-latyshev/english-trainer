import { Context, Effect, Layer, Schema } from 'effect';
import { DiagnosticEventSchema, Ipc, invokeUnitCommand } from '@/core/ipc';
import type { DiagnosticEvent } from '../types';

type DiagnosticsShape = {
  readonly record: (event: DiagnosticEvent) => Effect.Effect<void>;
};

export class Diagnostics extends Context.Service<Diagnostics, DiagnosticsShape>()(
  'core/diagnostics/Diagnostics',
) {
  static readonly layer = Layer.effect(
    Diagnostics,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        record: (event) =>
          Schema.encodeEffect(DiagnosticEventSchema)(event).pipe(
            Effect.flatMap((encoded) =>
              invokeUnitCommand(ipc, 'record_diagnostic_event', { event: encoded }),
            ),
            Effect.ignore,
            Effect.forkDetach,
            Effect.asVoid,
          ),
      };
    }),
  );
}
