import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import { tabs } from './styles';

const { root, list, tab, indicator, panel } = tabs();

type RootProps = {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  children: ReactNode;
};

export function Tabs({ value, onValueChange, className, children }: RootProps) {
  return (
    <BaseTabs.Root
      className={root({ className })}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next);
      }}
      value={value}
    >
      {children}
    </BaseTabs.Root>
  );
}

type ListProps = { label: string; children: ReactNode };

export function TabsList({ label, children }: ListProps) {
  return (
    <BaseTabs.List activateOnFocus aria-label={label} className={list()}>
      {children}
      <BaseTabs.Indicator className={indicator()} />
    </BaseTabs.List>
  );
}

type TabProps = { value: string; children: ReactNode };

export function TabsTab({ value, children }: TabProps) {
  return (
    <BaseTabs.Tab className={tab()} value={value}>
      {children}
    </BaseTabs.Tab>
  );
}

type PanelProps = { value: string; children: ReactNode };

export function TabsPanel({ value, children }: PanelProps) {
  return (
    <BaseTabs.Panel className={panel()} value={value}>
      {children}
    </BaseTabs.Panel>
  );
}
