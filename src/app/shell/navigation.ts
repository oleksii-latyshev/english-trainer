import { Bookmark, MessageCircle, Settings } from 'lucide-react';
import type React from 'react';
import { EVA_SETTINGS_PATH } from '@/screens/settings';

export type NavEntry = {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  matches: string[];
};

export const NAVIGATION: NavEntry[] = [
  {
    path: '/',
    label: 'Talk',
    icon: MessageCircle,
    matches: ['/', '/conversation', '/summary'],
  },
  { path: '/memory', label: 'Memory', icon: Bookmark, matches: ['/memory', '/memory/review'] },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    matches: ['/settings', EVA_SETTINGS_PATH],
  },
];

export function navLabel(item: NavEntry, dueCount: number): string {
  return item.path === '/memory' && dueCount > 0 ? `${item.label}, ${dueCount} due` : item.label;
}
