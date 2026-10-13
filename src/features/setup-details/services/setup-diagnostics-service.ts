import { Context, Effect, Layer } from 'effect';
import {
  Ipc,
  type IpcDecodeError,
  type IpcError,
  invokeCommand,
  type SetupDiagnostics,
  SetupDiagnosticsSchema,
} from '@/core/ipc';

type SetupDiagnosticsShape = {
  readonly read: Effect.Effect<SetupDiagnostics, IpcError | IpcDecodeError>;
};

export class SetupDiagnosticsService extends Context.Service<
  SetupDiagnosticsService,
  SetupDiagnosticsShape
>()('features/setup-details/SetupDiagnosticsService') {
  static readonly layer = Layer.effect(
    SetupDiagnosticsService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        read: Effect.suspend(() =>
          invokeCommand(ipc, 'get_setup_diagnostics', SetupDiagnosticsSchema),
        ),
      };
    }),
  );
}
