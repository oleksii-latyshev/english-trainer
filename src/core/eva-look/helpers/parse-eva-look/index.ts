import {
  BODY_COLOURS,
  DEFAULT_EVA_LOOK,
  EVA_MOTIONS,
  type EvaLook,
  INK_COLOURS,
  LEAF_COLOURS,
  PETAL_COLOURS,
} from '../../palette';

const LEGACY_BODY_IDS: Readonly<Record<string, string>> = { pearl: 'cloud' };

type Option = { readonly id: string; readonly lockedHint?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pick<T extends Option>(options: readonly T[], value: unknown, fallback: T['id']): T['id'] {
  const match = options.find((option) => option.id === value && option.lockedHint === undefined);
  return match ? match.id : fallback;
}

export function parseEvaLook(value: unknown): EvaLook {
  if (!isRecord(value)) return DEFAULT_EVA_LOOK;
  const storedBody = value.body ?? value.sphere;
  const body = typeof storedBody === 'string' ? (LEGACY_BODY_IDS[storedBody] ?? storedBody) : null;
  return {
    body: pick(BODY_COLOURS, body, DEFAULT_EVA_LOOK.body),
    ink: pick(INK_COLOURS, value.ink ?? value.eye, DEFAULT_EVA_LOOK.ink),
    leaf: pick(LEAF_COLOURS, value.leaf, DEFAULT_EVA_LOOK.leaf),
    petal: pick(PETAL_COLOURS, value.petal, DEFAULT_EVA_LOOK.petal),
    motion: pick(EVA_MOTIONS, value.motion, DEFAULT_EVA_LOOK.motion),
  };
}
