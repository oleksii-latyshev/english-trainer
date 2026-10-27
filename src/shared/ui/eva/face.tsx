import { CENTER_X, EYE_SPREAD, EYE_Y, MOUTH_Y } from './geometry';
import type { EvaFace } from './types';

const SIDES = [-1, 1] as const;
const EYE_RX = 6;
const THINKING_SHIFT_X = 3.5;
const THINKING_SHIFT_Y = -3.5;

type EyeSpec = { x: number; y: number; ry: number };

function eyeSpec(face: EvaFace, side: -1 | 1): EyeSpec {
  const x = CENTER_X + side * EYE_SPREAD;
  switch (face) {
    case 'listening':
      return { x, y: EYE_Y, ry: 8.12 };
    case 'thinking':
      return { x: x + THINKING_SHIFT_X, y: EYE_Y + THINKING_SHIFT_Y, ry: 6.16 };
    case 'idle':
    case 'speaking':
    case 'happy':
    case 'asleep':
      return { x, y: EYE_Y, ry: 7.25 };
  }
}

function RoundEye({ x, y, ry }: EyeSpec) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse
        className="fill-eva-ink eva-full:motion-safe:animate-eva-blink"
        rx={EYE_RX}
        ry={ry}
      />
    </g>
  );
}

function HappyEye({ side }: { side: -1 | 1 }) {
  const x = CENTER_X + side * EYE_SPREAD;
  return (
    <path
      className="stroke-eva-ink fill-none"
      d={`M${x - 6} 43.35A6 6 0 0 1 ${x + 6} 43.35`}
      strokeWidth={3}
    />
  );
}

function SleepingEye({ side }: { side: -1 | 1 }) {
  const x = CENTER_X + side * EYE_SPREAD;
  return (
    <path
      className="stroke-eva-ink fill-none"
      d={`M${x - 5.6} 39.6A5.6 4.6 0 0 0 ${x + 5.6} 39.6`}
      strokeWidth={2.8}
    />
  );
}

function Eye({ face, side }: { face: EvaFace; side: -1 | 1 }) {
  if (face === 'happy') return <HappyEye side={side} />;
  if (face === 'asleep') return <SleepingEye side={side} />;
  return <RoundEye {...eyeSpec(face, side)} />;
}

const LISTENING_MOUTH_TOP = MOUTH_Y - 2;
const LISTENING_MOUTH_RY = 3.75;
const LISTENING_MOUTH_GROWTH = 0.8;

function ListeningMouth({ level }: { level: number }) {
  const ry = LISTENING_MOUTH_RY * (1 + level * LISTENING_MOUTH_GROWTH);
  return (
    <ellipse
      className="fill-eva-ink"
      cx={CENTER_X}
      cy={LISTENING_MOUTH_TOP + ry}
      rx={3.5}
      ry={ry}
    />
  );
}

function Mouth({ face, level }: { face: EvaFace; level: number }) {
  switch (face) {
    case 'idle':
      return (
        <path
          className="stroke-eva-ink fill-none"
          d="M50.3 54.6A6.7 6.7 0 0 0 63.7 54.6"
          strokeWidth={2.6}
        />
      );
    case 'happy':
      return <path className="fill-eva-ink" d="M46 53.6H68A11 11 0 0 1 46 53.6Z" />;
    case 'listening':
      return <ListeningMouth level={level} />;
    case 'speaking':
      return (
        <path
          className="fill-eva-ink"
          d="M54.83 54.6H59.17A4.33 3.33 0 0 1 63.5 57.93V59.6A6.5 5 0 0 1 57 64.6A6.5 5 0 0 1 50.5 59.6V57.93A4.33 3.33 0 0 1 54.83 54.6Z"
        />
      );
    case 'thinking':
      return <rect className="fill-eva-ink" height={2.4} rx={1.2} width={8} x={56} y={MOUTH_Y} />;
    case 'asleep':
      return (
        <ellipse className="fill-eva-ink opacity-70" cx={CENTER_X} cy={59.6} rx={2.5} ry={2} />
      );
  }
}

export function Face({ face, level }: { face: EvaFace; level: number }) {
  return (
    <>
      {SIDES.map((side) => (
        <Eye face={face} key={side} side={side} />
      ))}
      <Mouth face={face} level={level} />
    </>
  );
}
