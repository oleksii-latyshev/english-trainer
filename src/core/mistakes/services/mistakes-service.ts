import { Context, Effect, Layer, Stream } from 'effect';
import {
  ExerciseViewSchema,
  Ipc,
  IpcEvents,
  invokeCommand,
  invokeUnitCommand,
  MISTAKES_UPDATED_EVENT,
  MistakeDetailSchema,
  MistakeGroupsSchema,
  MistakesUpdatedSchema,
  RuleCardViewSchema,
  RunViewSchema,
} from '@/core/ipc';
import type {
  ExerciseView,
  InputKind,
  MistakeDetail,
  MistakeGroups,
  MistakesFailure,
  RuleCard,
  RuleKey,
  RunTarget,
  RunView,
} from '../types';

function targetArgs(target: RunTarget) {
  switch (target.kind) {
    case 'due':
      return { kind: 'due' };
    case 'one':
      return { kind: 'one', id: target.id };
    case 'rule':
      return { kind: 'rule', ruleKey: target.ruleKey };
  }
}

type MistakesServiceShape = {
  readonly groups: Effect.Effect<MistakeGroups, MistakesFailure>;
  readonly detail: (id: number) => Effect.Effect<MistakeDetail, MistakesFailure>;
  readonly ruleCard: (ruleKey: RuleKey) => Effect.Effect<RuleCard, MistakesFailure>;
  readonly archive: (id: number) => Effect.Effect<void, MistakesFailure>;
  readonly retryLesson: (id: number) => Effect.Effect<void, MistakesFailure>;
  readonly startRun: (target: RunTarget) => Effect.Effect<RunView, MistakesFailure>;
  readonly run: (runId: number) => Effect.Effect<RunView, MistakesFailure>;
  readonly answer: (
    runId: number,
    position: number,
    answer: string,
    input: InputKind,
  ) => Effect.Effect<ExerciseView, MistakesFailure>;
  readonly check: (runId: number, position: number) => Effect.Effect<ExerciseView, MistakesFailure>;
  readonly retryCheck: (attemptId: number) => Effect.Effect<void, MistakesFailure>;
  readonly finish: (runId: number) => Effect.Effect<RunView, MistakesFailure>;
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
        startRun: (target) =>
          invokeCommand(ipc, 'start_mistake_run', RunViewSchema, targetArgs(target)),
        run: (runId) => invokeCommand(ipc, 'get_mistake_run', RunViewSchema, { runId }),
        answer: (runId, position, answer, input) =>
          invokeCommand(ipc, 'answer_mistake_step', ExerciseViewSchema, {
            runId,
            position,
            answer,
            input,
          }),
        check: (runId, position) =>
          invokeCommand(ipc, 'check_mistake_answer', ExerciseViewSchema, { runId, position }),
        retryCheck: (attemptId) => invokeUnitCommand(ipc, 'retry_mistake_check', { attemptId }),
        finish: (runId) => invokeCommand(ipc, 'finish_mistake_run', RunViewSchema, { runId }),
        updates: events
          .listen(MISTAKES_UPDATED_EVENT, MistakesUpdatedSchema)
          .pipe(Stream.map(() => undefined)),
      };
    }),
  );
}
