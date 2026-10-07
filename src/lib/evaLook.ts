import { createLocalPreference, isRecord } from './localPreference';

/** Gradient stops of the sphere, lightest first: highlight, then three shades. */
type ShellStops = readonly [string, string, string, string];

export const SPHERE_COLOURS = [
  { id: 'pearl', name: 'Pearl', stops: ['#FFFFFF', '#EEF0F7', '#D2D7E5', '#AAB1C6'], eye: 'ink' },
  {
    id: 'lavender',
    name: 'Lavender',
    stops: ['#FFFFFF', '#EEEAFB', '#D5CCF2', '#AEA2D9'],
    eye: 'ink',
  },
  { id: 'mint', name: 'Mint', stops: ['#FFFFFF', '#E7F6F1', '#C6E7DC', '#98C9B9'], eye: 'ink' },
  { id: 'peach', name: 'Peach', stops: ['#FFFFFF', '#FCEEE7', '#F2D3C4', '#D9AB97'], eye: 'ink' },
  { id: 'sky', name: 'Sky', stops: ['#FFFFFF', '#E8F2FC', '#C9DDF3', '#9DB9DC'], eye: 'ink' },
  // A dark sphere needs light eyes to read.
  {
    id: 'graphite',
    name: 'Graphite',
    stops: ['#7A7D8C', '#4A4C57', '#2E3038', '#1B1C22'],
    eye: 'moonlight',
  },
] as const satisfies readonly { id: string; name: string; stops: ShellStops; eye: string }[];

export const EYE_COLOURS = [
  { id: 'ink', name: 'Ink', color: '#16171D' },
  { id: 'navy', name: 'Navy', color: '#1D2B5A' },
  { id: 'plum', name: 'Plum', color: '#3E1F4D' },
  { id: 'cocoa', name: 'Cocoa', color: '#3B2A22' },
  { id: 'moonlight', name: 'Moonlight', color: '#EEF3FF' },
] as const;

export const EVA_MOTIONS = [
  { id: 'full', label: 'Full', hint: 'Blinks, nods and reacts to voices' },
  { id: 'gentle', label: 'Gentle', hint: 'Blinks and changes faces, no bouncing' },
  { id: 'still', label: 'Still', hint: 'Faces change, nothing moves' },
] as const;

export type SphereId = (typeof SPHERE_COLOURS)[number]['id'];
export type EyeId = (typeof EYE_COLOURS)[number]['id'];
export type EvaMotion = (typeof EVA_MOTIONS)[number]['id'];

export type EvaLook = { sphere: SphereId; eye: EyeId; motion: EvaMotion };

export const DEFAULT_EVA_LOOK: EvaLook = { sphere: 'pearl', eye: 'ink', motion: 'full' };

export const EVA_LOOK_KEY = 'english_trainer_eva_look';

function pickId<T extends { id: string }>(
  options: readonly T[],
  value: unknown,
  fallback: T['id'],
): T['id'] {
  const match = options.find((option) => option.id === value);
  return match ? match.id : fallback;
}

/** Accepts the parsed stored value; anything invalid falls back per field. */
export function parseEvaLook(value: unknown): EvaLook {
  if (!isRecord(value)) return DEFAULT_EVA_LOOK;
  return {
    sphere: pickId(SPHERE_COLOURS, value.sphere, DEFAULT_EVA_LOOK.sphere),
    eye: pickId(EYE_COLOURS, value.eye, DEFAULT_EVA_LOOK.eye),
    motion: pickId(EVA_MOTIONS, value.motion, DEFAULT_EVA_LOOK.motion),
  };
}

function findSphere(id: SphereId) {
  return SPHERE_COLOURS.find((sphere) => sphere.id === id) ?? SPHERE_COLOURS[0];
}

function findEye(id: EyeId) {
  return EYE_COLOURS.find((eye) => eye.id === id) ?? EYE_COLOURS[0];
}

/** Choosing a sphere also picks the eyes that suit it; the eyes can be changed afterwards. */
export function withSphere(look: EvaLook, sphere: SphereId): EvaLook {
  return { ...look, sphere, eye: findSphere(sphere).eye };
}

export function sphereGradient(id: SphereId): string {
  const [hi, one, two, three] = findSphere(id).stops;
  return `radial-gradient(circle at 34% 22%, ${hi} 0%, ${one} 34%, ${two} 70%, ${three} 100%)`;
}

/** The custom properties Eva reads (src/components/eva/eva.css). */
export function evaLookCssVars(look: EvaLook): Record<string, string> {
  const [hi, one, two, three] = findSphere(look.sphere).stops;
  return {
    '--shell-hi': hi,
    '--shell-1': one,
    '--shell-2': two,
    '--shell-3': three,
    '--eye-color': findEye(look.eye).color,
  };
}

export function evaEyeColor(id: EyeId): string {
  return findEye(id).color;
}

export const evaLookPreference = createLocalPreference<EvaLook>(EVA_LOOK_KEY, parseEvaLook);
