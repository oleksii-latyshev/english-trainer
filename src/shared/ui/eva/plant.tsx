import type { EvaStage } from './types';

const STEM_HEIGHT: Record<EvaStage, number> = { 0: 0, 1: 12, 2: 15, 3: 20, 4: 22, 5: 25 };
const SPARKLES = [
  { x: -26, y: -2, className: 'fill-eva-spark' },
  { x: 25, y: -10, className: 'fill-white' },
  { x: 30, y: 8, className: 'fill-eva-spark-warm' },
  { x: -20, y: -20, className: 'fill-white' },
  { x: 6, y: -22, className: 'fill-eva-spark' },
] as const;

export type PlantIds = { seed: string; leafRight: string; leafLeft: string; bud: string };

type PlantProps = { stage: EvaStage; ids: PlantIds };

function leafPath(width: number, height: number, side: 'left' | 'right'): string {
  if (side === 'right') {
    return `M0.4 0A${width} ${height} 0 0 1 ${width + 0.4} ${height}A${width} ${height} 0 0 1 0.4 0Z`;
  }
  return `M-0.4 0A${width} ${height} 0 0 0 ${-width - 0.4} ${height}A${width} ${height} 0 0 0 -0.4 0Z`;
}

function Flower({ stage, stemTop }: { stage: EvaStage; stemTop: number }) {
  const isFull = stage >= 5;
  const centreRadius = isFull ? 4.5 : 3.6;
  const distance = isFull ? 7.5 : 6.2;
  const petalRadius = isFull ? 5.5 : 4.7;
  const petalCount = isFull ? 6 : 5;
  const centreY = stemTop - 5;
  const angles = Array.from(
    { length: petalCount },
    (_, index) => -Math.PI / 2 + (index * 2 * Math.PI) / petalCount,
  );
  return (
    <>
      {angles.map((angle) => (
        <circle
          className="fill-eva-petal"
          cx={Math.cos(angle) * distance}
          cy={centreY + Math.sin(angle) * distance}
          key={angle}
          r={petalRadius}
        />
      ))}
      <circle className="fill-eva-petal-centre" cx={0} cy={centreY} r={centreRadius} />
      {isFull &&
        SPARKLES.map((sparkle) => (
          <circle
            className={sparkle.className}
            cx={sparkle.x}
            cy={centreY + sparkle.y}
            key={`${sparkle.x}:${sparkle.y}`}
            r={1.1}
          />
        ))}
    </>
  );
}

function Bud({ stemTop, fill }: { stemTop: number; fill: string }) {
  const top = stemTop - 12;
  const d = `M-5.5 ${top + 8.4}A5.5 8.4 0 0 1 0 ${top}A5.5 8.4 0 0 1 5.5 ${top + 8.4}A5.5 5.6 0 0 1 0 ${top + 14}A5.5 5.6 0 0 1 -5.5 ${top + 8.4}Z`;
  return <path d={d} fill={`url(#${fill})`} />;
}

export function Plant({ stage, ids }: PlantProps) {
  const stemHeight = STEM_HEIGHT[stage];
  const stemTop = -stemHeight;
  const isFull = stage >= 5;
  const leafWidth = isFull ? 22 : 20;
  const leafHeight = isFull ? 13 : 12;
  const leafTop = stage === 1 ? stemTop - 6 : stemTop * 0.55 - 6;
  return (
    <>
      {stage === 0 && <ellipse cx={0} cy={-2.5} fill={`url(#${ids.seed})`} rx={5} ry={4} />}
      {stage >= 1 && (
        <rect
          className="fill-eva-leaf-dark"
          height={stemHeight + 3}
          rx={1.2}
          width={2.4}
          x={-1.2}
          y={stemTop}
        />
      )}
      {stage >= 1 && (
        <path
          d={leafPath(leafWidth, leafHeight, 'right')}
          fill={`url(#${ids.leafRight})`}
          transform={`translate(0 ${leafTop})`}
        />
      )}
      {stage >= 2 && (
        <path
          d={leafPath(leafWidth, leafHeight, 'left')}
          fill={`url(#${ids.leafLeft})`}
          transform={`translate(0 ${leafTop})`}
        />
      )}
      {stage === 3 && <Bud fill={ids.bud} stemTop={stemTop} />}
      {stage >= 4 && <Flower stage={stage} stemTop={stemTop} />}
    </>
  );
}
