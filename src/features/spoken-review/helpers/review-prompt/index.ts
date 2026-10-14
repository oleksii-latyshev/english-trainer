import type { LearningItemType } from '@/core/ipc';

export type ReviewPrompt = {
  readonly label: string;
  readonly text: string;
  readonly spoken: string;
};

export function reviewPrompt(
  itemType: LearningItemType,
  cue: string,
  isGeneratedSituation = false,
): ReviewPrompt {
  if (itemType === 'mistake' && !isGeneratedSituation) {
    return {
      label: 'Eva · say it better',
      text: cue,
      spoken: `Say this one better. ${cue}`,
    };
  }
  return { label: 'Eva · situation', text: cue, spoken: `Here is a situation. ${cue}` };
}
