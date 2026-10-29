export type MarkedWord = { readonly text: string; readonly isMarked: boolean };

function normalised(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
}

function commonLengths(said: readonly string[], corrected: readonly string[]): number[][] {
  const table = Array.from({ length: said.length + 1 }, () =>
    new Array<number>(corrected.length + 1).fill(0),
  );
  for (let row = said.length - 1; row >= 0; row -= 1) {
    for (let column = corrected.length - 1; column >= 0; column -= 1) {
      table[row][column] =
        said[row] === corrected[column]
          ? table[row + 1][column + 1] + 1
          : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }
  return table;
}

function keptPositions(said: readonly string[], corrected: readonly string[]): ReadonlySet<number> {
  const table = commonLengths(said, corrected);
  const kept = new Set<number>();
  let row = 0;
  let column = 0;
  while (row < said.length && column < corrected.length) {
    if (said[row] === corrected[column]) {
      kept.add(column);
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      row += 1;
    } else {
      column += 1;
    }
  }
  return kept;
}

export function markedWords(said: string, corrected: string): readonly MarkedWord[] {
  const correctedWords = corrected.split(/\s+/).filter((word) => word !== '');
  const kept = keptPositions(
    said
      .split(/\s+/)
      .filter((word) => word !== '')
      .map(normalised),
    correctedWords.map(normalised),
  );
  return correctedWords.map((text, index) => ({ text, isMarked: !kept.has(index) }));
}
