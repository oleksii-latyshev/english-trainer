import { useAtom, useAtomSet } from '@effect/atom-react';
import type { ReactNode } from 'react';
import {
  BODY_COLOURS,
  bodySwatch,
  EVA_MOTIONS,
  evaLookAtom,
  INK_COLOURS,
  LEAF_COLOURS,
  leafSwatch,
  PETAL_COLOURS,
  petalSwatch,
  withBody,
} from '@/core/eva-look';
import { Button } from '@/shared/ui/button';
import { GlassPanel } from '@/shared/ui/glass-panel';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { Swatch } from '@/shared/ui/swatch';
import { Switch } from '@/shared/ui/switch';
import { growthHint } from '../../helpers/preview-caption';
import { dockIconAtom, growthAtom, resetEvaSettingsAtom } from '../../model/atoms';
import { DOCK_ICONS } from '../../preferences';

const MOTION_OPTIONS = EVA_MOTIONS.map((motion) => ({ value: motion.id, label: motion.label }));

function LookRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-4">
      <span className="w-24 flex-none font-semibold text-caption text-muted">{name}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">{children}</div>
    </div>
  );
}

function ChosenName({ children }: { children: ReactNode }) {
  return <span className="ml-2 text-faint">{children}</span>;
}

function Hint({ children }: { children: ReactNode }) {
  return <span className="text-caption text-faint">{children}</span>;
}

function lockedHintOf(option: object): string | undefined {
  return 'lockedHint' in option && typeof option.lockedHint === 'string'
    ? option.lockedHint
    : undefined;
}

export function EvaLookControls() {
  const [look, setLook] = useAtom(evaLookAtom);
  const [{ showGrowth }, setGrowth] = useAtom(growthAtom);
  const [{ icon }, setDockIcon] = useAtom(dockIconAtom);
  const reset = useAtomSet(resetEvaSettingsAtom);
  const body = BODY_COLOURS.find((option) => option.id === look.body) ?? BODY_COLOURS[0];
  const ink = INK_COLOURS.find((option) => option.id === look.ink) ?? INK_COLOURS[0];
  const leaf = LEAF_COLOURS.find((option) => option.id === look.leaf) ?? LEAF_COLOURS[0];
  const petal = PETAL_COLOURS.find((option) => option.id === look.petal) ?? PETAL_COLOURS[0];
  const motion = EVA_MOTIONS.find((option) => option.id === look.motion) ?? EVA_MOTIONS[0];

  return (
    <GlassPanel aria-label="Look" className="flex min-w-0 flex-1 flex-col gap-1 px-6 py-5">
      <LookRow name="Body">
        {BODY_COLOURS.map((option) => (
          <Swatch
            background={bodySwatch(option)}
            isSelected={look.body === option.id}
            key={option.id}
            name={option.name}
            onSelect={() => setLook(withBody(look, option.id))}
            shape="body"
          />
        ))}
        <ChosenName>{body.name}</ChosenName>
      </LookRow>
      <LookRow name="Eyes">
        {INK_COLOURS.map((option) => (
          <Swatch
            background={option.colour}
            isSelected={look.ink === option.id}
            key={option.id}
            name={option.name}
            onSelect={() => setLook({ ...look, ink: option.id })}
          />
        ))}
        <ChosenName>{ink.name} eyes</ChosenName>
      </LookRow>
      <LookRow name="Leaves">
        {LEAF_COLOURS.map((option) => (
          <Swatch
            background={leafSwatch(option)}
            isSelected={look.leaf === option.id}
            key={option.id}
            lockedHint={lockedHintOf(option)}
            name={option.name}
            onSelect={() => setLook({ ...look, leaf: option.id })}
            shape="leaf"
          />
        ))}
        <ChosenName>{leaf.name} leaves</ChosenName>
      </LookRow>
      <LookRow name="Bloom">
        {PETAL_COLOURS.map((option) => (
          <Swatch
            background={petalSwatch(option)}
            isSelected={look.petal === option.id}
            key={option.id}
            lockedHint={lockedHintOf(option)}
            name={option.name}
            onSelect={() => setLook({ ...look, petal: option.id })}
          />
        ))}
        <ChosenName>{petal.name}</ChosenName>
      </LookRow>
      <hr className="my-2 border-line-soft" />
      <LookRow name="Animation">
        <SegmentedControl
          label="Animation"
          onChange={(next) => setLook({ ...look, motion: next })}
          options={MOTION_OPTIONS}
          size="md"
          value={look.motion}
        />
        <Hint>{motion.hint}</Hint>
      </LookRow>
      <LookRow name="Growth">
        <Switch
          checked={showGrowth}
          isLabelHidden
          label="Show growth"
          onCheckedChange={(next) => setGrowth({ showGrowth: next })}
        />
        <Hint>{growthHint(showGrowth)}</Hint>
      </LookRow>
      <LookRow name="Dock icon">
        <SegmentedControl
          label="Dock icon"
          onChange={(next) => setDockIcon({ icon: next })}
          options={DOCK_ICONS}
          size="md"
          value={icon}
        />
        <Hint>Only the Dock changes; Finder and Launchpad keep Eva's icon.</Hint>
      </LookRow>
      <div className="mt-auto flex justify-end pt-3">
        <Button onClick={() => reset()} tone="secondary">
          Reset to default
        </Button>
      </div>
    </GlassPanel>
  );
}
