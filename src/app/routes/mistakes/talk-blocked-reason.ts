import type { DueMemory } from '@/core/learning-memory';

type Activity = { readonly isSessionOpen: boolean; readonly isAudioBusy: boolean };

export function talkBlockedReason(due: DueMemory, activity: Activity): string | null {
  if (due.tag === 'unavailable') return 'Reload the app to check your repeated mistakes.';
  if (due.tag === 'loading') return 'Your repeated mistakes are still loading.';
  if (activity.isSessionOpen) return 'Continue or finish the current conversation first.';
  if (activity.isAudioBusy) return 'Wait for the microphone to become available.';
  if (due.usualMistakes.length === 0) return 'Mistakes need to appear at least twice first.';
  return null;
}
