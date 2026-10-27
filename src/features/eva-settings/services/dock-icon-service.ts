import { Context, Effect, Layer } from 'effect';
import { Ipc, invokeUnitCommand } from '@/core/ipc';
import type { EvaStage } from '@/shared/ui/eva';
import type { DockIcon } from '../preferences';

type DockIconServiceShape = {
  readonly apply: (icon: DockIcon, stage: EvaStage | null) => Effect.Effect<void>;
};

export class DockIconService extends Context.Service<DockIconService, DockIconServiceShape>()(
  'features/eva-settings/DockIconService',
) {
  static readonly layer = Layer.effect(
    DockIconService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      return {
        apply: (icon, stage) =>
          invokeUnitCommand(ipc, 'set_dock_icon', { icon, stage }).pipe(
            Effect.ignore({ log: 'Warn', message: 'Could not change the Dock icon.' }),
          ),
      };
    }),
  );
}
