import { Context, Effect, Layer, Stream } from 'effect';
import {
  Ipc,
  IpcEvents,
  invokeCommand,
  invokeUnitCommand,
  MISTAKES_UPDATED_EVENT,
  MistakeDetailSchema,
  MistakeGroupsSchema,
  MistakesUpdatedSchema,
  RuleCardViewSchema,
} from '@/core/ipc';
import type { MistakeDetail, MistakeGroups, MistakesFailure, RuleCard, RuleKey } from '../types';

type MistakesServiceShape = {
  readonly groups: Effect.Effect<MistakeGroups, MistakesFailure>;
  readonly detail: (id: number) => Effect.Effect<MistakeDetail, MistakesFailure>;
  readonly ruleCard: (ruleKey: RuleKey) => Effect.Effect<RuleCard, MistakesFailure>;
  readonly archive: (id: number) => Effect.Effect<void, MistakesFailure>;
  readonly retryLesson: (id: number) => Effect.Effect<void, MistakesFailure>;
  readonly updates: Stream.Stream<void>;
};

export class MistakesService extends Context.Service<MistakesService, MistakesServiceShape>()(
  'core/mistakes/MistakesService',
) {
  static readonly layer = Layer.effect(
    MistakesService,
    Effect.gen(function* () {
      const ipc = yield* Ipc;
      const events = yield* IpcEvents;
      return {
        groups: invokeCommand(ipc, 'list_mistake_groups', MistakeGroupsSchema),
        detail: (id) => invokeCommand(ipc, 'get_mistake', MistakeDetailSchema, { id }),
        ruleCard: (ruleKey) => invokeCommand(ipc, 'get_rule_card', RuleCardViewSchema, { ruleKey }),
        archive: (id) => invokeUnitCommand(ipc, 'archive_mistake', { id }),
        retryLesson: (id) => invokeUnitCommand(ipc, 'retry_mistake_lesson', { id }),
        updates: events
          .listen(MISTAKES_UPDATED_EVENT, MistakesUpdatedSchema)
          .pipe(Stream.map(() => undefined)),
      };
    }),
  );
}
