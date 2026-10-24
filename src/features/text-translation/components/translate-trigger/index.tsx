import { RegistryContext, useAtomValue } from '@effect/atom-react';
import { Languages } from 'lucide-react';
import { type MouseEvent, useContext } from 'react';
import { Button } from '@/shared/ui/button';
import { TRANSLATION_UI_ATTRIBUTE } from '../../helpers/selection-reader';
import { panelOpenAtom, selectionAtom } from '../../model/atoms';
import { translateSelection } from '../../model/commands';

const TRIGGER_ATTRIBUTE = { [TRANSLATION_UI_ATTRIBUTE]: '' };
const PLACEMENT_CLASS = {
  above: '-translate-x-1/2 -translate-y-[calc(100%+10px)]',
  below: '-translate-x-1/2 translate-y-2.5',
} as const;

function keepSelection(event: MouseEvent) {
  event.preventDefault();
}

export function TranslateTrigger() {
  const registry = useContext(RegistryContext);
  const selection = useAtomValue(selectionAtom);
  const isPanelOpen = useAtomValue(panelOpenAtom);
  if (selection === undefined || isPanelOpen) return null;
  const { anchor, text } = selection;
  return (
    <div
      className={`fixed z-82 ${PLACEMENT_CLASS[anchor.placement]}`}
      style={{ left: anchor.left, top: anchor.top }}
      {...TRIGGER_ATTRIBUTE}
    >
      <Button
        aria-label={`Translate “${text}”`}
        onClick={() => translateSelection(registry)}
        onMouseDown={keepSelection}
        size="sm"
        tone="primary"
      >
        <Languages />
        Translate
      </Button>
    </div>
  );
}
