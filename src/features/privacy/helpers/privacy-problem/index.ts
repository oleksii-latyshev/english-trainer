import type { PrivacyAction } from '../../types';

export const RETENTION_UNREADABLE = 'The audio setting could not be read.';

const PROBLEM_COPY: Record<PrivacyAction, string> = {
  save: 'The setting could not be saved. Try again.',
  delete: 'The recordings could not be deleted. Try again.',
};

export function privacyProblemMessage(action: PrivacyAction): string {
  return PROBLEM_COPY[action];
}
