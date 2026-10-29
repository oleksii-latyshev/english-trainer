import type {
  ExerciseViewSchema,
  InputKindSchema,
  IpcDecodeError,
  IpcError,
  MistakeDetailSchema,
  MistakeGroupsSchema,
  RuleCardViewSchema,
  RunViewSchema,
} from '@/core/ipc';

export type MistakesFailure = IpcError | IpcDecodeError;

export type MistakeGroups = typeof MistakeGroupsSchema.Type;

export type MistakeGroup = MistakeGroups['groups'][number];

export type MistakeSummary = MistakeGroup['mistakes'][number];

export type MistakeDetail = typeof MistakeDetailSchema.Type;

export type RuleCard = typeof RuleCardViewSchema.Type;

export type RuleKey = RuleCard['rule_key'];

export type RunView = typeof RunViewSchema.Type;

export type ExerciseView = typeof ExerciseViewSchema.Type;

export type ExerciseResult = NonNullable<ExerciseView['result']>;

export type InputKind = typeof InputKindSchema.Type;

export type RunTarget =
  | { readonly kind: 'due' }
  | { readonly kind: 'one'; readonly id: number }
  | { readonly kind: 'rule'; readonly ruleKey: RuleKey };
