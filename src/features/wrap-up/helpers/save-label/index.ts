export function savePhrasesLabel(count: number): string {
  return count === 1 ? 'Save 1 phrase to Memory' : `Save all ${count} phrases to Memory`;
}
