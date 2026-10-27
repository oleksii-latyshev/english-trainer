import { useAtomValue } from '@effect/atom-react';
import { evaNappingAtom, evaStageAtom } from '@/core/eva-growth';
import { Eva } from '@/shared/ui/eva';
import { greeting } from '../../helpers/greeting';

type Props = {
  name: string;
};

export function StartGreeting({ name }: Props) {
  const stage = useAtomValue(evaStageAtom);
  const isNapping = useAtomValue(evaNappingAtom);
  return (
    <header className="flex items-center gap-5">
      <Eva decorative mood={isNapping ? 'asleep' : 'happy'} size={88} stage={stage} />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting(new Date().getHours(), name)}
        </h1>
        <p className="text-body text-muted mt-1.5">What would you like to talk about today?</p>
      </div>
    </header>
  );
}
