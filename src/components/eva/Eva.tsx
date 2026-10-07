import './eva.css';
import './evaMoods.css';

// Shared by the Talk start screen, the Talk stage, spoken review, first run and message avatars.
export type EvaMood =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'encouraging'
  | 'curious'
  | 'concerned'
  | 'asleep';

type Props = {
  mood: EvaMood;
  /** Outer size in px, halo included. The sphere is 44% of it. */
  size: number;
  /** Accessible name; defaults to "Eva, <mood>". Pass `decorative` to hide her from assistive tech. */
  label?: string;
  decorative?: boolean;
};

export function Eva({ mood, size, label, decorative = false }: Props) {
  const accessibility = decorative
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': label ?? `Eva, ${mood}` };

  return (
    <div className={`eva eva-${mood}`} style={{ width: size, height: size }} {...accessibility}>
      <span className="eva-halo" />
      <span className="eva-ring" />
      <span className="eva-core">
        <b className="eva-face">
          <i className="eva-eye eva-eye-l" />
          <i className="eva-eye eva-eye-r" />
          <i className="eva-mouth" />
        </b>
      </span>
    </div>
  );
}

export function EvaMini() {
  return (
    <span aria-hidden="true" className="eva-mini">
      <i />
      <i />
    </span>
  );
}
