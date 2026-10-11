import type { CSSProperties } from 'react';
import type { PlantIds } from './plant';

export type DefIds = PlantIds & { body: string; shade: string; blush: string; ground: string };

function stop(offset: number, colour: string, opacity?: number) {
  const style: CSSProperties = { stopColor: `var(${colour})`, stopOpacity: opacity };
  return <stop key={`${offset}:${colour}`} offset={offset} style={style} />;
}

const BODY_TRANSFORM = 'translate(0.45 0.3) scale(0.778 0.99) translate(-0.45 -0.3)';

export function Defs({ ids }: { ids: DefIds }) {
  return (
    <defs>
      <radialGradient cx={0.45} cy={0.3} gradientTransform={BODY_TRANSFORM} id={ids.body} r={1}>
        {stop(0, '--eva-body-hi')}
        {stop(0.45, '--eva-body-mid')}
        {stop(1, '--eva-body-edge')}
      </radialGradient>
      <linearGradient id={ids.shade} x1={0} x2={0} y1={0} y2={1}>
        {stop(0.6, '--eva-body-shade', 0)}
        {stop(1, '--eva-body-shade')}
      </linearGradient>
      <linearGradient id={ids.seed} x1={0.33} x2={0.67} y1={0.03} y2={0.97}>
        {stop(0, '--eva-leaf-light')}
        {stop(1, '--eva-leaf-dark')}
      </linearGradient>
      <linearGradient id={ids.leafRight} x1={0} x2={1} y1={0} y2={1}>
        {stop(0, '--eva-leaf-light')}
        {stop(1, '--eva-leaf-dark')}
      </linearGradient>
      <linearGradient id={ids.leafLeft} x1={1} x2={0} y1={0} y2={1}>
        {stop(0, '--eva-leaf-light')}
        {stop(1, '--eva-leaf-dark')}
      </linearGradient>
      <linearGradient id={ids.bud} x1={0} x2={0} y1={1} y2={0}>
        {stop(0, '--eva-leaf-dark')}
        {stop(0.35, '--eva-leaf-dark')}
        {stop(0.8, '--eva-petal')}
      </linearGradient>
      <filter height="300%" id={ids.blush} width="200%" x="-50%" y="-100%">
        <feGaussianBlur stdDeviation={1.2} />
      </filter>
      <filter height="500%" id={ids.ground} width="140%" x="-20%" y="-200%">
        <feGaussianBlur stdDeviation={4} />
      </filter>
    </defs>
  );
}
