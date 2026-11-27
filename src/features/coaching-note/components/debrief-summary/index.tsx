import { takenLine } from '../../helpers/taken-line';
import type { DebriefWord } from '../../types';

type Props = {
  words: readonly DebriefWord[];
  isTaken: (word: DebriefWord) => boolean;
};

export function DebriefSummary({ words, isTaken }: Props) {
  const taken = words.filter(isTaken);
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
    </section>
  );
}
