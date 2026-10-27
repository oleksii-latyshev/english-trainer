const PRACTICE_QUESTIONS = 5;
const SHOWN_SAMPLES = 2;

export type PracticeBlock = {
  readonly isLibraryError: boolean;
  readonly isLibraryReady: boolean;
  readonly isSessionOpen: boolean;
  readonly isAudioBusy: boolean;
  readonly practicableCount: number;
};

export function practiceBlockedReason(block: PracticeBlock): string {
  if (block.isLibraryError) return 'Reload Memory to check your repeated mistakes.';
  if (!block.isLibraryReady) return 'Your repeated mistakes are still loading.';
  if (block.isSessionOpen) return 'Continue or finish the current conversation first.';
  if (block.isAudioBusy) return 'Wait for the microphone to become available.';
  if (block.practicableCount === 0) return 'Mistakes need to appear at least twice first.';
  return '';
}

function quoted(text: string): string {
  return `“${text}”`;
}

export function practiceSummary(samples: readonly string[], practicableCount: number): string {
  const lead = `${PRACTICE_QUESTIONS} short spoken questions`;
  const shown = samples.slice(0, SHOWN_SAMPLES);
  if (shown.length === 0) return lead;
  const rest = practicableCount - shown.length;
  const list = shown.map(quoted);
  if (rest > 0) return `${lead} built on ${list.join(', ')} and ${rest} more.`;
  return `${lead} built on ${list.join(' and ')}.`;
}
