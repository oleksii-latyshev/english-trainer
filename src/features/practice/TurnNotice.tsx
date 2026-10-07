import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  message: string;
  /** The one fix action. */
  children?: ReactNode;
};

/** A problem in one sentence with one fix, amber rather than red: mistakes are never alarming. */
export function TurnNotice({ message, children }: Props) {
  return (
    <div className="talk-notice" role="alert">
      <TriangleAlert aria-hidden="true" size={18} />
      <span>{message}</span>
      {children}
    </div>
  );
}
