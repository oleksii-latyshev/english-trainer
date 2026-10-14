import { useAtomValue } from '@effect/atom-react';
import { Button } from '@/shared/ui/button';
import { phraseLabelOf } from '../../helpers/phrase-copy';
import { shownMaterialAtom } from '../../model/materials-atoms';
import { sessionAtom, shownItemAtom } from '../../model/session-atoms';
import { useReviewCommands } from '../../model/use-review-commands';
import { contextStatusAtom, isBusyAtom } from '../../model/view-atoms';
import { phraseBar, statusDot } from './styles';

const MASK_WIDTHS = ['w-17.5', 'w-10', 'w-14'] as const;

export function PhraseBar() {
  const item = useAtomValue(shownItemAtom);
  const session = useAtomValue(sessionAtom);
  const material = useAtomValue(shownMaterialAtom);
  const status = useAtomValue(contextStatusAtom);
  const isBusy = useAtomValue(isBusyAtom);
  const commands = useReviewCommands();
  const step = session?.step;
  if (item === null || step === undefined) return null;

  const { root, label, phrase, mask, bar, status: statusSlot, cued } = phraseBar();
  const shown = step.tag === 'result' ? step.result.target : (material?.hint ?? null);
  const isPhrase = item.item_type === 'phrase';
  const canReveal = isPhrase && step.tag === 'answering' && shown === null;
  const isCued = isPhrase && step.tag === 'answering' && material?.is_cued === true;

  return (
    <div className={root()}>
      <span className={label()}>{phraseLabelOf(item.item_type)}</span>
      {shown !== null && <span className={phrase()}>{shown}</span>}
      {shown === null && (
        <span aria-hidden="true" className={mask()}>
          {MASK_WIDTHS.map((width) => (
            <i className={bar({ className: width })} key={width} />
          ))}
        </span>
      )}
      {status !== null && (
        <span className={statusSlot()}>
          <i aria-hidden="true" className={statusDot({ status })} />
          {status}
        </span>
      )}
      {canReveal && (
        <Button
          className="ml-auto"
          disabled={isBusy}
          onClick={commands.revealPhrase}
          size="sm"
          tone="secondary"
        >
          Show phrase · counts as help
        </Button>
      )}
      {isCued && <span className={cued()}>Shown before answering · practice only</span>}
    </div>
  );
}
