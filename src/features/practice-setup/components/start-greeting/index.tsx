import { useAtomValue } from '@effect/atom-react';
import { evaNappingAtom, evaStageAtom } from '@/core/eva-growth';
import { Eva } from '@/shared/ui/eva';
import { greeting } from '../../helpers/greeting';

export function StartGreeting() {
  const stage = useAtomValue(evaStageAtom);
  const isNapping = useAtomValue(evaNappingAtom);
  return (
    <header className="flex items-center gap-5">
      <Eva decorative mood={isNapping ? 'asleep' : 'happy'} size={88} stage={stage} />
      <div>
        <h1 className="font-bold text-3xl tracking-tight">{greeting(new Date().getHours())}</h1>
        <p className="mt-1.5 text-body text-muted">What would you like to talk about today?</p>
      </div>
    </header>
  );
}
