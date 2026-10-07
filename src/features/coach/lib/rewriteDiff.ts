export type RewritePart = { text: string; isChanged: boolean };

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, '');
}

/** Which words of `rewrite` have no counterpart in `original`, keeping the original's word order. */
function changedFlags(original: string[], rewrite: string[]): boolean[] {
  const rows = original.length + 1;
  const cols = rewrite.length + 1;
  const lengths: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = rows - 2; i >= 0; i--) {
    for (let j = cols - 2; j >= 0; j--) {
      lengths[i][j] =
        original[i] === rewrite[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const flags = new Array<boolean>(rewrite.length).fill(true);
  let i = 0;
  let j = 0;
  while (i < original.length && j < rewrite.length) {
    if (original[i] === rewrite[j]) {
      flags[j] = false;
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return flags;
}

function mergeParts(parts: RewritePart[]): RewritePart[] {
  const merged: RewritePart[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.isChanged === part.isChanged) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

/**
 * Splits a rewrite into runs, marking the words the learner did not say. Spacing between two
 * changed words belongs to the highlight so a changed phrase reads as one piece.
 */
export function highlightRewrite(original: string, rewrite: string): RewritePart[] {
  const originalWords = original.split(/\s+/).map(normalizeWord).filter(Boolean);
  if (originalWords.length === 0) return rewrite ? [{ text: rewrite, isChanged: false }] : [];

  const tokens = rewrite.split(/(\s+)/).filter((token) => token !== '');
  const wordIndexes = tokens.flatMap((token, index) => (/^\s+$/.test(token) ? [] : [index]));
  const words = wordIndexes.map((index) => normalizeWord(tokens[index]));
  const flags = changedFlags(originalWords, words);

  const isChangedAt = new Map(
    wordIndexes.map((tokenIndex, wordIndex) => [tokenIndex, flags[wordIndex]]),
  );
  const parts = tokens.map((text, index) => {
    const isSpace = /^\s+$/.test(text);
    if (!isSpace) return { text, isChanged: isChangedAt.get(index) === true };
    return {
      text,
      isChanged: isChangedAt.get(index - 1) === true && isChangedAt.get(index + 1) === true,
    };
  });
  return mergeParts(parts);
}
