export function isSummary(step: number, cardCount: number): boolean {
  return step >= cardCount;
}

export function nextStep(step: number, cardCount: number): number {
  return Math.min(step + 1, cardCount);
}

export function previousStep(step: number): number {
  return Math.max(step - 1, 0);
}

export function progressLabel(step: number, cardCount: number): string {
  return `${Math.min(step, cardCount - 1) + 1} / ${cardCount}`;
}

export function nextLabel(step: number, cardCount: number): string {
  return step === cardCount - 1 ? 'Finish' : 'Next';
}
