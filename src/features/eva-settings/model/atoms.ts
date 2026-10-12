import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import { DEFAULT_EVA_LOOK, type EvaLook, evaLookAtom } from '@/core/eva-look';
import type { EvaMood, EvaStage } from '@/shared/ui/eva';
import { DockIconSchema } from '../helpers/dock-icon-schema';
import { GrowthSchema } from '../helpers/growth-schema';
import { DEFAULT_PREVIEW_MOOD } from '../helpers/mood-guide';
import { DEFAULT_PREVIEW_STAGE } from '../helpers/preview-caption';
import { DEFAULT_DOCK_ICON, DEFAULT_GROWTH } from '../preferences';
import { DockIconService } from '../services/dock-icon-service';
import { runtime } from './runtime';

export const DOCK_ICON_KEY = 'english_trainer_dock_icon';
export const GROWTH_KEY = 'english_trainer_eva_growth';

export const dockIconAtom = Atom.kvs({
  runtime,
  key: DOCK_ICON_KEY,
  schema: DockIconSchema,
  defaultValue: () => DEFAULT_DOCK_ICON,
  mode: 'sync',
});

export const growthAtom = Atom.kvs({
  runtime,
  key: GROWTH_KEY,
  schema: GrowthSchema,
  defaultValue: () => DEFAULT_GROWTH,
  mode: 'sync',
});

export const dockIconSyncAtom = runtime.atom((get) =>
  Effect.gen(function* () {
    const service = yield* DockIconService;
    yield* service.apply(get(dockIconAtom).icon);
  }),
);

export const previewMoodAtom = Atom.make<EvaMood>(DEFAULT_PREVIEW_MOOD);

export const previewStageAtom = Atom.make<EvaStage>(DEFAULT_PREVIEW_STAGE);

export const pickPreviewStageAtom = Atom.fnSync<EvaStage>()((stage, get) => {
  get.set(previewStageAtom, stage);
  get.set(growthAtom, DEFAULT_GROWTH);
});

export const resetEvaSettingsAtom = Atom.fnSync<void>()((_, get) => {
  const look: EvaLook = DEFAULT_EVA_LOOK;
  get.set(evaLookAtom, look);
  get.set(growthAtom, DEFAULT_GROWTH);
  get.set(dockIconAtom, DEFAULT_DOCK_ICON);
  get.set(previewMoodAtom, DEFAULT_PREVIEW_MOOD);
  get.set(previewStageAtom, DEFAULT_PREVIEW_STAGE);
});
