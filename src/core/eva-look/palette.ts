type BodyStops = readonly [string, string, string, string];

export const BODY_COLOURS = [
  {
    id: 'cloud',
    name: 'Cloud',
    stops: ['#FFFFFF', '#EEF8FF', '#C4E6FF', 'rgba(120, 185, 240, 0.45)'],
    ink: 'ink',
  },
  {
    id: 'sky',
    name: 'Sky',
    stops: ['#F6FCFF', '#C6E8FF', '#82C8FF', 'rgba(60, 140, 230, 0.4)'],
    ink: 'ink',
  },
  {
    id: 'mint',
    name: 'Mint',
    stops: ['#FFFFFF', '#E6FAF0', '#A9E6C8', 'rgba(70, 170, 120, 0.4)'],
    ink: 'ink',
  },
  {
    id: 'peach',
    name: 'Peach',
    stops: ['#FFFFFF', '#FFF0E6', '#FFC9A8', 'rgba(230, 140, 90, 0.38)'],
    ink: 'ink',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    stops: ['#FFFFFF', '#F1EDFF', '#C9BCFF', 'rgba(140, 115, 230, 0.4)'],
    ink: 'ink',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    stops: ['#9AA3B6', '#646C80', '#3E4557', 'rgba(0, 0, 0, 0.4)'],
    ink: 'moonlight',
  },
] as const satisfies readonly { id: string; name: string; stops: BodyStops; ink: string }[];

export const INK_COLOURS = [
  { id: 'ink', name: 'Ink', colour: '#22304F' },
  { id: 'navy', name: 'Navy', colour: '#1D2B5A' },
  { id: 'plum', name: 'Plum', colour: '#3E1F4D' },
  { id: 'cocoa', name: 'Cocoa', colour: '#3B2A22' },
  { id: 'moonlight', name: 'Moonlight', colour: '#EEF3FF' },
] as const;

export const LEAF_COLOURS = [
  { id: 'spring', name: 'Spring', light: '#B5F0C8', dark: '#6FC08C' },
  { id: 'sky', name: 'Sky', light: '#C9ECFF', dark: '#6CB8F0' },
  { id: 'blossom', name: 'Blossom', light: '#FFD3E2', dark: '#E98BB0' },
  {
    id: 'autumn',
    name: 'Autumn',
    light: '#FFD9A0',
    dark: '#E39A4F',
    lockedHint: 'Unlocks with your 4th garden plant',
  },
] as const satisfies readonly {
  id: string;
  name: string;
  light: string;
  dark: string;
  lockedHint?: string;
}[];

export const PETAL_COLOURS = [
  { id: 'pink', name: 'Pink', petal: '#FF9EC0', centre: '#FFD66B' },
  { id: 'sky', name: 'Bluebell', petal: '#7CC8FF', centre: '#FFE08A' },
  { id: 'lilac', name: 'Lilac', petal: '#C3A8FF', centre: '#FFD66B' },
  {
    id: 'sun',
    name: 'Sunflower',
    petal: '#FFD166',
    centre: '#E58A3A',
    lockedHint: 'Unlocks after 5 sunshine days',
  },
] as const satisfies readonly {
  id: string;
  name: string;
  petal: string;
  centre: string;
  lockedHint?: string;
}[];

export const EVA_MOTIONS = [
  { id: 'full', label: 'Full', hint: 'Breathes, blinks, leaf sways' },
  { id: 'gentle', label: 'Gentle', hint: 'Only the leaf sways' },
  { id: 'still', label: 'Still', hint: 'Faces change, nothing moves' },
] as const;

export type BodyId = (typeof BODY_COLOURS)[number]['id'];
export type InkId = (typeof INK_COLOURS)[number]['id'];
export type LeafId = (typeof LEAF_COLOURS)[number]['id'];
export type PetalId = (typeof PETAL_COLOURS)[number]['id'];
export type EvaMotion = (typeof EVA_MOTIONS)[number]['id'];

export type EvaLook = {
  body: BodyId;
  ink: InkId;
  leaf: LeafId;
  petal: PetalId;
  motion: EvaMotion;
};

export const DEFAULT_EVA_LOOK: EvaLook = {
  body: 'cloud',
  ink: 'ink',
  leaf: 'spring',
  petal: 'pink',
  motion: 'full',
};
