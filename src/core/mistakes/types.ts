import type {
  IpcDecodeError,
  IpcError,
  MistakeDetailSchema,
  MistakeGroupsSchema,
  RuleCardViewSchema,
} from '@/core/ipc';

export type MistakesFailure = IpcError | IpcDecodeError;

export type MistakeGroups = typeof MistakeGroupsSchema.Type;

export type MistakeGroup = MistakeGroups['groups'][number];

export type MistakeSummary = MistakeGroup['mistakes'][number];

export type MistakeDetail = typeof MistakeDetailSchema.Type;

export type RuleCard = typeof RuleCardViewSchema.Type;

export type RuleKey = RuleCard['rule_key'];
