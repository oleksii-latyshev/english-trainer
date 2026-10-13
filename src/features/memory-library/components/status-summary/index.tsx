import { useAtomValue } from '@effect/atom-react';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { statusLabel } from '../../helpers/library-copy';
import { ACTIVE_STATUSES, statusCounts } from '../../helpers/memory-entries';
import { libraryAtom } from '../../model/atoms';
import { StatusDot } from '../status-dot';
import { statusSegment } from './styles';

export function StatusSummary() {
  const library = useAtomValue(libraryAtom);
  const counts = statusCounts(library.tag === 'ready' ? library.entries : []);
  const total = ACTIVE_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  return (
    <GlassPanel aria-label="Where they are" className="flex flex-col gap-2.5 px-4.5 py-4">
      <div className="flex justify-between">
        <h2 className="font-bold text-body">Where they are</h2>
        <span className="text-caption text-faint">{total === 1 ? '1 item' : `${total} items`}</span>
      </div>
      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {ACTIVE_STATUSES.filter((status) => counts[status] > 0).map((status) => (
          <span
            className={statusSegment({ status })}
            key={status}
            style={{ flexGrow: counts[status] }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-caption text-quiet-foreground">
        {ACTIVE_STATUSES.map((status) => (
          <li className="flex items-center gap-1.5" key={status}>
            <StatusDot status={status} />
            {statusLabel(status)} {counts[status]}
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
