import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { focusRuleLine } from '../../helpers/focus-rule-line';
import { habitLine } from '../../helpers/habit-line';
import { takenLine } from '../../helpers/taken-line';
import { wonPhrases } from '../../helpers/win-line';
import type { DebriefWin, DebriefWord, FocusRule, Habit, RuleKey } from '../../types';

type Props = {
  words: readonly DebriefWord[];
  wins: readonly DebriefWin[];
  habits: readonly Habit[];
  focusRule: FocusRule | null;
  isStartingRun: boolean;
  onPractiseRule: (ruleKey: RuleKey) => void;
  isTaken: (word: DebriefWord) => boolean;
};

export function DebriefSummary({
  words,
  wins,
  habits,
  focusRule,
  isStartingRun,
  onPractiseRule,
  isTaken,
}: Props) {
  const taken = words.filter(isTaken);
  const won = wonPhrases(wins);
  return (
    <section
      aria-label="Debrief summary"
      className="border-line bg-surface flex flex-col gap-3 rounded-2xl border px-4.5 py-3.5"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-body m-0 font-semibold">Words you took</h3>
        {words.length > 0 && (
          <span className="text-caption text-faint" role="status">
            {takenLine(taken.length, words.length)}
          </span>
        )}
      </div>
      {taken.length === 0 ? (
        <p className="text-caption text-muted m-0">
          {words.length === 0
            ? 'No new words came out of this conversation.'
            : 'You did not take any words. You can go back and take some.'}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {taken.map((word) => (
            <li className="flex flex-col gap-0.5" key={`${word.sequence}:${word.phrase}`}>
              <span className="text-body text-foreground font-semibold wrap-anywhere">
                {word.phrase}
              </span>
              <span className="text-caption text-muted leading-copy">{word.meaning}</span>
            </li>
          ))}
        </ul>
      )}
      {won.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-caption text-faint m-0 font-normal">Used on your own</h4>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {won.map((phrase) => (
              <li className="text-caption text-ok font-semibold wrap-anywhere" key={phrase}>
                ✓ {phrase}
              </li>
            ))}
          </ul>
        </div>
      )}
      {habits.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-caption text-faint m-0 font-normal">Your habits</h4>
          <p className="text-caption text-muted leading-copy m-0">
            Plain words that come up in your recent conversations.
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {habits.map((habit) => (
              <li className="text-caption text-foreground font-semibold" key={habit.word}>
                {habitLine(habit)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {focusRule && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-caption text-faint m-0 font-normal">Rule to practise</h4>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-body text-foreground font-semibold">{focusRule.title}</span>
            {focusRule.came_back && <Chip tone="warning">Came back</Chip>}
          </div>
          <p className="text-caption text-muted leading-copy m-0">{focusRule.summary}</p>
          <p className="text-caption text-faint m-0">{focusRuleLine(focusRule)}</p>
          <div>
            <Button
              onClick={() => onPractiseRule(focusRule.rule_key)}
              pending={isStartingRun}
              tone="secondary"
            >
              Practise this rule
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
