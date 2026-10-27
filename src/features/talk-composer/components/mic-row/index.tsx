import { useAtomValue } from '@effect/atom-react';
import { Mic, Play, Square } from 'lucide-react';
import type { ReactNode } from 'react';
import { LevelMeter } from '@/shared/ui/level-meter';
import { RecordButton } from '@/shared/ui/record-button';
import { pressMic } from '../../model/commands';
import { useComposerRegistry, useTurn } from '../../model/use-composer';
import { canPressMicAtom } from '../../model/view-atoms';

type Props = {
  rescueSlot?: ReactNode;
};

function MicIcon({ icon }: { icon: 'mic' | 'stop' | 'resume' }) {
  if (icon === 'stop') return <Square aria-hidden="true" fill="currentColor" />;
  if (icon === 'resume') return <Play aria-hidden="true" fill="currentColor" />;
  return <Mic aria-hidden="true" />;
}

export function MicRow({ rescueSlot }: Props) {
  const registry = useComposerRegistry();
  const { state, presentation, level } = useTurn();
  const canPress = useAtomValue(canPressMicAtom);
  const isLive = (state.tag === 'listening' || state.tag === 'auto-listen') && state.isLive;

  return (
    <>
      <RecordButton
        aria-label={presentation.micName}
        disabled={!canPress}
        onClick={() => pressMic(registry)}
        state={presentation.micVariant}
      >
        <MicIcon icon={presentation.micIcon} />
      </RecordButton>
      <div className="flex min-w-0 flex-1 flex-col gap-0.75" role="status">
        <span className="font-semibold">
          {presentation.micTitle}
          {state.tag === 'auto-listen' && (
            <span className="bg-accent-soft text-accent-text text-pip ml-2 rounded-full px-2 py-0.5 uppercase">
              Auto
            </span>
          )}
        </span>
        <span className="text-caption text-faint">{presentation.micHint}</span>
      </div>
      <LevelMeter label="Microphone level" level={isLive ? level : 0} />
      {rescueSlot}
    </>
  );
}
