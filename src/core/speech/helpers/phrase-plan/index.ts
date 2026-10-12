import {
  CLAUSE_OVERRUN_CHARS,
  FIRST_PHRASE_MAX_CHARS,
  LATER_PHRASE_MAX_CHARS,
  LEAD_SHARE_FOR_SYNTHESIS,
  MIN_PHRASE_CHARS,
  MIN_TRAILING_CHARS,
  PHRASE_BUDGET_FLOOR_CHARS,
} from '../speech-timing';
import type { SynthesisEstimate } from '../synthesis-pacing';

export type PhraseBudget = {
  readonly maxChars: number;
  readonly overrunChars: number;
};

export type PhraseCut = {
  readonly phrase: string;
  readonly rest: readonly string[];
};

const CLAUSE_BREAK = /[,;:]\s+|\s+(?=(?:and|but|because|so|which|when)\s)/g;
const COMMA_LIKE = /[,;:]/;

export const FIRST_PHRASE_BUDGET: PhraseBudget = {
  maxChars: FIRST_PHRASE_MAX_CHARS,
  overrunChars: 0,
};

export function laterPhraseBudget(leadMs: number, estimate: SynthesisEstimate): PhraseBudget {
  const affordableMs = leadMs * LEAD_SHARE_FOR_SYNTHESIS - estimate.fixedMs;
  const affordableChars = Math.floor(affordableMs / estimate.perCharMs);
  const maxChars = Math.min(
    LATER_PHRASE_MAX_CHARS,
    Math.max(PHRASE_BUDGET_FLOOR_CHARS, affordableChars),
  );
  return { maxChars, overrunChars: CLAUSE_OVERRUN_CHARS };
}

function clauseBreakPositions(sentence: string): number[] {
  return [...sentence.matchAll(CLAUSE_BREAK)].map(
    (match) => match.index + (COMMA_LIKE.test(match[0][0] ?? '') ? 1 : 0),
  );
}

function leavesRoomOnBothSides(sentence: string, position: number): boolean {
  return position >= MIN_PHRASE_CHARS && sentence.length - position >= MIN_TRAILING_CHARS;
}

function clauseCut(sentence: string, budget: PhraseBudget): number | undefined {
  const positions = clauseBreakPositions(sentence).filter((position) =>
    leavesRoomOnBothSides(sentence, position),
  );
  const withinBudget = positions.filter((position) => position <= budget.maxChars);
  const lastWithinBudget = withinBudget[withinBudget.length - 1];
  if (lastWithinBudget !== undefined) return lastWithinBudget;
  return positions.find((position) => position <= budget.maxChars + budget.overrunChars);
}

function wordCut(sentence: string, budget: PhraseBudget): number {
  const prefix = sentence.slice(0, budget.maxChars + 1);
  const lastSpace = prefix.lastIndexOf(' ');
  if (lastSpace > 0 && sentence.length - lastSpace >= MIN_TRAILING_CHARS) return lastSpace;
  return sentence.indexOf(' ', budget.maxChars);
}

export function cutPhrase(pending: readonly string[], budget: PhraseBudget): PhraseCut | null {
  const [sentence, ...following] = pending;
  if (sentence === undefined) return null;
  if (sentence.length <= budget.maxChars + budget.overrunChars)
    return { phrase: sentence, rest: following };
  const position = clauseCut(sentence, budget) ?? wordCut(sentence, budget);
  if (position <= 0) return { phrase: sentence, rest: following };
  return {
    phrase: sentence.slice(0, position).trim(),
    rest: [sentence.slice(position).trim(), ...following],
  };
}
