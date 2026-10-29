import type { ReactNode } from 'react';

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-faint text-xs tracking-wide uppercase">{children}</div>;
}
