import { useAtomSet } from '@effect/atom-react';
import type { MistakeDetail } from '@/core/mistakes';
import { Button } from '@/shared/ui/button';
import { Disclosure } from '@/shared/ui/disclosure';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { retryLessonAtom } from '../../model/atoms';
import { Label } from '../label';
import { RuleDetails } from '../rule-details';

type Props = { mistake: MistakeDetail };

function Pending({ mistake }: Props) {
  return (
    <>
      <p className="text-body m-0 font-semibold" role="status">
        Preparing the lesson…
      </p>
      <p className="text-muted m-0">
        You can keep going. The lesson appears here when it is ready.
      </p>
      {mistake.review_explanation && (
        <>
          <Label>From your review</Label>
          <p className="m-0" data-word-lookup>
            {mistake.review_explanation}
          </p>
        </>
      )}
    </>
  );
}

function Failed({ mistake }: Props) {
  const retry = useAtomSet(retryLessonAtom);
  return (
    <>
      <p className="text-body m-0 font-semibold">The lesson is not ready yet.</p>
      <p className="text-muted m-0">Something got in the way. You can ask Eva to try again.</p>
      <Button className="self-start" onClick={() => retry(mistake.id)} size="sm" tone="secondary">
        Retry
      </Button>
    </>
  );
}

function Ready({ mistake }: Props) {
  const lesson = mistake.lesson;
  if (lesson === null) return <Pending mistake={mistake} />;
  return (
    <>
      <Label>Why</Label>
      <p className="m-0" data-word-lookup>
        {lesson.explanation}
      </p>
      {lesson.contrast.length > 0 && (
        <>
          <Label>The rule</Label>
          <div className="grid grid-cols-2 gap-3">
            {lesson.contrast.map((line) => (
              <div
                className="rounded-control border-line bg-surface-2 flex flex-col gap-1 border px-4 py-3"
                key={line.label}
              >
                <b>{line.label}</b>
                <span className="text-control text-muted" data-word-lookup>
                  {line.sentence}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {lesson.examples.length > 0 && (
        <>
          <Label>Examples</Label>
          <ul
            className="text-control text-muted m-0 flex list-none flex-col gap-1 p-0"
            data-word-lookup
          >
            {lesson.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        </>
      )}
      {lesson.word && (
        <>
          <Label>Word to learn</Label>
          <p className="m-0" data-word-lookup>
            <b>{lesson.word.word}</b> · {lesson.word.meaning}
          </p>
        </>
      )}
    </>
  );
}

export function LessonPanel({ mistake }: Props) {
  const rule = mistake.rule;
  return (
    <GlassPanel aria-label="Lesson" className="flex flex-col gap-4 overflow-hidden">
      <div className="flex flex-col gap-4 p-6">
        {mistake.lesson_state === 'ready' && <Ready mistake={mistake} />}
        {mistake.lesson_state === 'pending' && <Pending mistake={mistake} />}
        {mistake.lesson_state === 'failed' && <Failed mistake={mistake} />}
      </div>
      {rule && rule.rule_key !== 'other' && (
        <Disclosure summary="Open the full rule">
          <RuleDetails ruleKey={rule.rule_key} />
        </Disclosure>
      )}
    </GlassPanel>
  );
}
