const MAX_STREAM_CHARS = 12_000;

export type SpeechStreamState = {
  acceptedText: string;
  pendingText: string;
  spokenText: string;
  isFinished: boolean;
};

export function createSpeechStreamState(): SpeechStreamState {
  return { acceptedText: '', pendingText: '', spokenText: '', isFinished: false };
}

const ABBREVIATIONS = new Set([
  'dr',
  'mr',
  'mrs',
  'ms',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'e.g',
  'i.e',
  'no',
  'fig',
]);

function isPeriodSentenceBoundary(text: string, index: number): boolean {
  const previous = text[index - 1] ?? '';
  const next = text[index + 1] ?? '';
  if (/\d/.test(previous) && (!next || /\d/.test(next))) return false;
  const precedingWord = text.slice(0, index).match(/(?:[A-Za-z]+\.)*[A-Za-z]+$/)?.[0] ?? '';
  if (precedingWord.length === 1) return false;
  return !ABBREVIATIONS.has(precedingWord.toLowerCase());
}

function hasUnclosedQuote(text: string): boolean {
  let isOpen = false;
  for (const character of text) {
    if (character === '"') isOpen = !isOpen;
    if (character === '“') isOpen = true;
    if (character === '”') isOpen = false;
  }
  return isOpen;
}

function sentenceEnd(text: string, index: number): number | null {
  const punctuation = text[index];
  if (punctuation !== '.' && punctuation !== '!' && punctuation !== '?') return null;
  if (punctuation === '.' && !isPeriodSentenceBoundary(text, index)) return null;
  let nextIndex = index + 1;
  while (nextIndex < text.length && /["'”’)]/.test(text[nextIndex] ?? '')) nextIndex += 1;
  if (nextIndex === text.length) {
    if (hasUnclosedQuote(text.slice(0, nextIndex))) return null;
    return nextIndex;
  }
  return /\s/.test(text[nextIndex] ?? '') ? nextIndex : null;
}

export type StreamOptions = {
  onStart?: (latencyMs: number) => void;
  onEnd?: () => void;
  onError?: () => void;
};

export type StreamHandle = {
  append: (delta: string) => void;
  finish: (finalText: string) => void;
  cancel: () => void;
};

export function cleanSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function boundSpeechText(text: string): string {
  const cleanText = cleanSpeechText(text);
  if (cleanText.length <= MAX_STREAM_CHARS) return cleanText;
  const prefix = cleanText.slice(0, MAX_STREAM_CHARS);
  const lastSpace = prefix.lastIndexOf(' ');
  return prefix.slice(0, lastSpace > 0 ? lastSpace : MAX_STREAM_CHARS).trimEnd();
}

export function appendSpeechDelta(
  state: SpeechStreamState,
  delta: string,
): { state: SpeechStreamState; utterances: string[] } {
  if (state.isFinished || !delta) return { state, utterances: [] };
  const remainingCapacity = MAX_STREAM_CHARS - state.acceptedText.length;
  if (remainingCapacity <= 0) return { state, utterances: [] };
  const accepted = delta.slice(0, remainingCapacity);
  const text = state.pendingText + accepted;
  const utterances: string[] = [];
  let sentenceStart = 0;
  for (let index = 0; index < text.length; index += 1) {
    const end = sentenceEnd(text, index);
    if (end === null) continue;
    const utterance = cleanSpeechText(text.slice(sentenceStart, end));
    if (utterance) utterances.push(utterance);
    sentenceStart = end;
    index = end - 1;
  }
  const pendingText = text.slice(sentenceStart).trimStart();
  const spokenText =
    utterances.length === 0
      ? state.spokenText
      : `${state.spokenText}${state.spokenText ? ' ' : ''}${utterances.join(' ')}`;
  return {
    state: {
      acceptedText: state.acceptedText + accepted,
      pendingText,
      spokenText,
      isFinished: false,
    },
    utterances,
  };
}

function normalizedWords(text: string): string[] {
  return (
    cleanSpeechText(text)
      .toLowerCase()
      .match(/[a-z0-9]+(?:['’][a-z0-9]+)*/g) ?? []
  );
}

function removeSpokenPrefix(finalText: string, spokenText: string): string {
  const finalWords = normalizedWords(finalText);
  const spokenWords = normalizedWords(spokenText);
  if (spokenWords.length === 0) return cleanSpeechText(finalText);
  if (spokenWords.length > finalWords.length) return '';
  const prefixMatches = spokenWords.every((word, index) => finalWords[index] === word);
  if (!prefixMatches) return '';

  const words = [...cleanSpeechText(finalText).matchAll(/[a-z0-9]+(?:['’][a-z0-9]+)*/gi)];
  const lastMatchedWord = words[spokenWords.length - 1];
  if (!lastMatchedWord || lastMatchedWord.index === undefined) return '';
  const suffix = cleanSpeechText(finalText).slice(
    lastMatchedWord.index + lastMatchedWord[0].length,
  );
  return cleanSpeechText(suffix.replace(/^[.,!?;:]+\s*/, ''));
}

export function finishSpeechStream(
  state: SpeechStreamState,
  finalText: string,
): { state: SpeechStreamState; utterances: string[] } {
  if (state.isFinished) return { state, utterances: [] };
  const canonicalText = boundSpeechText(finalText);
  const spokenPrefix = removeSpokenPrefix(canonicalText, state.spokenText);
  const tail =
    spokenPrefix || (state.spokenText ? '' : cleanSpeechText(state.pendingText || canonicalText));
  return {
    state: {
      ...state,
      pendingText: '',
      acceptedText: canonicalText.slice(0, MAX_STREAM_CHARS),
      isFinished: true,
      spokenText: tail
        ? `${state.spokenText}${state.spokenText ? ' ' : ''}${tail}`
        : state.spokenText,
    },
    utterances: tail ? [tail] : [],
  };
}
