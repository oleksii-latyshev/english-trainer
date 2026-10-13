import { Eva } from '@/shared/ui/eva';
import { greeting } from '../../helpers/greeting';

export function StartGreeting() {
  return (
    <header className="flex items-center gap-5">
      <Eva decorative mood="happy" size={88} />
      <div>
        <h1 className="font-bold text-3xl tracking-tight">{greeting(new Date().getHours())}</h1>
        <p className="mt-1.5 text-body text-muted">What would you like to talk about today?</p>
      </div>
    </header>
  );
}
