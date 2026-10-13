import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { disclosure } from './styles';

const { root, trigger, icon, panel } = disclosure();

type Props = {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Disclosure({ summary, children, className }: Props) {
  return (
    <Collapsible.Root className={root({ className })} data-slot="disclosure">
      <Collapsible.Trigger className={trigger()}>
        <ChevronRight aria-hidden="true" className={icon()} />
        {summary}
      </Collapsible.Trigger>
      <Collapsible.Panel className={panel()}>{children}</Collapsible.Panel>
    </Collapsible.Root>
  );
}
