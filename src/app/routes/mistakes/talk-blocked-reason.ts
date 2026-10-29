import type { UsualRules } from '@/core/mistakes';

type Activity = { readonly isSessionOpen: boolean; readonly isAudioBusy: boolean };

export function talkBlockedReason(usual: UsualRules, activity: Activity): string | null {
  if (usual.tag === 'unavailable') return 'Reload the app to check your repeated mistakes.';
  if (usual.tag === 'loading') return 'Your repeated mistakes are still loading.';
  if (activity.isSessionOpen) return 'Continue or finish the current conversation first.';
  if (activity.isAudioBusy) return 'Wait for the microphone to become available.';
  if (usual.rules.length === 0) return 'A rule needs at least two mistakes first.';
  return null;
}
