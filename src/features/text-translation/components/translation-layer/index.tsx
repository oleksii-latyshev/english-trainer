import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { Languages } from 'lucide-react';
import { useContext } from 'react';
import { Button } from '@/shared/ui/button';
import { TRANSLATION_UI_ATTRIBUTE } from '../../helpers/selection-reader';
import { panelOpenAtom } from '../../model/atoms';
import { openPanel } from '../../model/commands';
import { translationSessionAtom } from '../../model/session';
import { TranslateTrigger } from '../translate-trigger';
import { TranslationPanel } from '../translation-panel';

const LAUNCHER_ATTRIBUTE = { [TRANSLATION_UI_ATTRIBUTE]: '' };

export function TranslationLayer() {
  useAtomMount(translationSessionAtom);
  const registry = useContext(RegistryContext);
  const isPanelOpen = useAtomValue(panelOpenAtom);
  return (
    <>
      <TranslateTrigger />
      <div className="fixed right-6 bottom-5 z-80" {...LAUNCHER_ATTRIBUTE}>
        <Button onClick={() => openPanel(registry)} size="sm" tone="secondary">
          <Languages />
          Translate a phrase
        </Button>
      </div>
      {isPanelOpen && <TranslationPanel />}
    </>
  );
}
