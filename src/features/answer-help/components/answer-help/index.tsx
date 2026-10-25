import { useAnswerHelp } from '../../model/use-answer-help';
import { LevelRow } from '../level-row';
import { PlanPanel } from '../plan-panel';

type Props = { isDisabled: boolean };

export function AnswerHelp({ isDisabled }: Props) {
  const help = useAnswerHelp(isDisabled);
  return (
    <section aria-label="Answer help" className="flex flex-col gap-2">
      {help.notice !== null && (
        <p className="m-0 text-caption text-muted leading-normal" role="status">
          {help.notice}
        </p>
      )}
      <LevelRow isDisabled={isDisabled} level={help.level} onChoose={help.choose} />
      {help.level !== null && (
        <PlanPanel
          isDisabled={isDisabled}
          isPlanning={help.isPlanning}
          isRecording={help.isRecording}
          level={help.level}
          onCancelPlanning={help.cancelPlanning}
          onHide={() => help.choose(null)}
          onRetry={help.retry}
          onStartPlanning={help.startPlanning}
          plan={help.plan}
          remainingSeconds={help.remainingSeconds}
        />
      )}
    </section>
  );
}
