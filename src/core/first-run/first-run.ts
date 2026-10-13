export const FIRST_RUN_PATH = '/welcome';

export const FIRST_RUN_KEY = 'english_trainer_first_run';

export type FirstRunStatus = 'pending' | 'finished' | 'skipped' | 'existing';

export type FirstRunMarker = { readonly status: FirstRunStatus };

export const FIRST_RUN_STATUSES = [
  'pending',
  'finished',
  'skipped',
  'existing',
] as const satisfies readonly FirstRunStatus[];

export const PENDING_MARKER: FirstRunMarker = { status: 'pending' };
