type Activity = { readonly isSessionOpen: boolean; readonly isAudioBusy: boolean };

export function micBlockedReason(activity: Activity): string | null {
  if (activity.isSessionOpen)
    return 'Continue or finish the current conversation to use the microphone.';
  if (activity.isAudioBusy) return 'Wait for the microphone to become available.';
  return null;
}
