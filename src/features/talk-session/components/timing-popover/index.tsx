import { Gauge } from 'lucide-react';
import type { SpeechTiming } from '@/core/speech';
import { Button } from '@/shared/ui/button';
import { Popover } from '@/shared/ui/popover';
import { formatTiming, hasTiming, TIMING_STAGES } from '../../helpers/timing-stages';

type Props = { timing: SpeechTiming };

export function TimingPopover({ timing }: Props) {
  if (!hasTiming(timing)) return null;
  return (
    <Popover
      align="end"
      label="Speech pipeline timing"
      trigger={
        <Button aria-label="Speech pipeline timing" iconOnly size="sm" tone="quiet">
          <Gauge aria-hidden="true" />
        </Button>
      }
    >
      <div className="flex w-72 flex-col gap-2 p-3">
        <h3 className="text-body m-0 font-bold">Speech pipeline latency</h3>
        <dl className="m-0 flex flex-col gap-1">
          {TIMING_STAGES.map((stage) => (
            <div className="text-caption flex justify-between gap-3" key={stage.key}>
              <dt className="text-muted">{stage.label}</dt>
              <dd className="text-foreground m-0 font-mono">{formatTiming(timing[stage.key])}</dd>
            </div>
          ))}
        </dl>
        <p className="text-faint leading-copy m-0 text-xs">
          Measured locally on this device. Raw audio is discarded after transcription.
        </p>
      </div>
    </Popover>
  );
}
