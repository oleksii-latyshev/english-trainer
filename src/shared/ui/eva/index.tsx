import { useId } from 'react';
import { type DefIds, Defs } from './defs';
import { Face } from './face';
import {
  BODY_HEIGHT,
  BODY_PATH,
  BODY_WIDTH,
  CENTER_X,
  PLANT_BASE_Y,
  VIEW_BOTTOM,
  VIEW_LEFT,
  VIEW_WIDTH,
  viewTop,
} from './geometry';
import { Plant } from './plant';
import { DEFAULT_EVA_STAGE, type EvaFace, type EvaMood, type EvaStage, faceOfMood } from './types';

export { DEFAULT_EVA_STAGE, type EvaMood, type EvaStage };

type Props = {
  mood: EvaMood;
  size: number;
  stage?: EvaStage | null;
  audioLevel?: number;
  label?: string;
  decorative?: boolean;
};

const BLUSH_OFFSET = 34.2;
const BLUSH_Y = 55.05;

function defIds(prefix: string): DefIds {
  return {
    body: `${prefix}-body`,
    shade: `${prefix}-shade`,
    seed: `${prefix}-seed`,
    leafRight: `${prefix}-leaf-right`,
    leafLeft: `${prefix}-leaf-left`,
    bud: `${prefix}-bud`,
    blush: `${prefix}-blush`,
    ground: `${prefix}-ground`,
  };
}

function clampLevel(level: number | undefined): number {
  return Math.max(0, Math.min(1, level ?? 0));
}

type DrawingProps = { ids: DefIds; stage: EvaStage | null; face: EvaFace; level: number };

function Drawing({ ids, stage, face, level }: DrawingProps) {
  return (
    <>
      <Defs ids={ids} />
      <ellipse
        className="fill-eva-ground"
        cx={CENTER_X}
        cy={BODY_HEIGHT + 8}
        filter={`url(#${ids.ground})`}
        rx={BODY_WIDTH * 0.39}
        ry={4}
      />
      <g transform={`translate(${CENTER_X} ${BODY_HEIGHT})`}>
        <g className="eva-full:motion-safe:animate-eva-breathe">
          <g transform={`translate(${-CENTER_X} ${-BODY_HEIGHT})`}>
            <path d={BODY_PATH} fill={`url(#${ids.body})`} />
            <path d={BODY_PATH} fill={`url(#${ids.shade})`} />
            {stage !== null && (
              <g transform={`translate(${CENTER_X} ${PLANT_BASE_Y})`}>
                <g className="eva-live:motion-safe:animate-eva-sway">
                  <Plant ids={ids} stage={stage} />
                </g>
              </g>
            )}
            {[-1, 1].map((side) => (
              <ellipse
                className="fill-eva-blush"
                cx={CENTER_X + side * BLUSH_OFFSET}
                cy={BLUSH_Y}
                filter={`url(#${ids.blush})`}
                key={side}
                rx={7.5}
                ry={3.75}
              />
            ))}
            <Face face={face} level={level} />
          </g>
        </g>
      </g>
    </>
  );
}

export function Eva({
  mood,
  size,
  stage = DEFAULT_EVA_STAGE,
  audioLevel,
  label,
  decorative = false,
}: Props) {
  const ids = defIds(`eva${useId().replace(/:/g, '')}`);
  const top = viewTop(stage);
  const height = VIEW_BOTTOM - top;
  const name = label ?? `Eva, ${mood}`;
  const face = faceOfMood(mood);
  const level = face === 'listening' ? clampLevel(audioLevel) : 0;
  const frame = {
    'data-mood': mood,
    height: (size * height) / VIEW_WIDTH,
    viewBox: `${VIEW_LEFT} ${top} ${VIEW_WIDTH} ${height}`,
    width: size,
    xmlns: 'http://www.w3.org/2000/svg',
  };
  const drawing = <Drawing face={face} ids={ids} level={level} stage={stage} />;

  if (decorative) {
    return (
      <svg aria-hidden="true" {...frame}>
        {drawing}
      </svg>
    );
  }
  return (
    <svg aria-label={name} role="img" {...frame}>
      <title>{name}</title>
      {drawing}
    </svg>
  );
}
