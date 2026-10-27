import { Droplets, Moon, Sun } from 'lucide-react';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { IconTile } from '@/shared/ui/icon-tile';
import { GROWTH_RULES } from '../../helpers/growth-copy';

const RULE_ICONS = {
  drops: { icon: Droplets, tone: 'sky' },
  sunshine: { icon: Sun, tone: 'green' },
  'days-off': { icon: Moon, tone: 'grey' },
} as const;

export function HowItGrows() {
  return (
    <GlassPanel aria-labelledby="how-it-grows-heading" className="flex flex-col gap-5 px-6 py-6">
      <h2 className="text-caption text-faint font-semibold" id="how-it-grows-heading">
        How Eva grows
      </h2>
      {GROWTH_RULES.map((rule) => {
        const { icon: Icon, tone } = RULE_ICONS[rule.id];
        return (
          <div className="flex gap-3.5" key={rule.id}>
            <IconTile tone={tone}>
              <Icon strokeWidth={1.8} />
            </IconTile>
            <div>
              <h3 className="text-body font-bold">{rule.title}</h3>
              <p className="text-muted leading-copy mt-1 mb-0">{rule.body}</p>
            </div>
          </div>
        );
      })}
    </GlassPanel>
  );
}
