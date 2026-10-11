import type { BODY_COLOURS, LEAF_COLOURS, PETAL_COLOURS } from '../../palette';

type BodyColour = (typeof BODY_COLOURS)[number];
type LeafColour = (typeof LEAF_COLOURS)[number];
type PetalColour = (typeof PETAL_COLOURS)[number];

export function bodySwatch({ stops: [hi, mid, edge] }: BodyColour): string {
  return `radial-gradient(ellipse at 45% 30%, ${hi} 0%, ${mid} 45%, ${edge} 100%)`;
}

export function leafSwatch({ light, dark }: LeafColour): string {
  return `linear-gradient(135deg, ${light}, ${dark})`;
}

export function petalSwatch({ petal, centre }: PetalColour): string {
  return `radial-gradient(circle, ${centre} 0 26%, ${petal} 30%)`;
}
