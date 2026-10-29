import { Bookmark, MessageCircle, Settings, Sparkles } from 'lucide-react';
import type React from 'react';
import { EVA_SETTINGS_PATH } from '@/screens/settings';

export type NavEntry = {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  matches: string[];
  due?: DueKey;
};

type DueKey = 'memory' | 'mistakes';

export type DueCounts = Readonly<Record<DueKey, number>>;

export const NAVIGATION: NavEntry[] = [
  {
    path: '/',
    label: 'Talk',
    icon: MessageCircle,
    matches: ['/', '/conversation', '/summary'],
  },
  { path: '/mistakes', label: 'Mistakes', icon: Sparkles, matches: ['/mistakes'], due: 'mistakes' },
  {
    path: '/memory',
    label: 'Memory',
    icon: Bookmark,
    matches: ['/memory', '/memory/review'],
    due: 'memory',
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    matches: ['/settings', EVA_SETTINGS_PATH],
  },
];

export function isCurrent(item: NavEntry, currentPath: string): boolean {
  return (
    item.matches.includes(currentPath) ||
    (item.path !== '/' && currentPath.startsWith(`${item.path}/`))
  );
}

export function dueOf(item: NavEntry, counts: DueCounts): number {
  return item.due ? counts[item.due] : 0;
}

export function navLabel(item: NavEntry, counts: DueCounts): string {
  const due = dueOf(item, counts);
  return due > 0 ? `${item.label}, ${due} due` : item.label;
}
