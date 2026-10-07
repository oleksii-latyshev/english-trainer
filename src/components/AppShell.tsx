import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Bookmark, MessageCircle, Settings } from 'lucide-react';
import type React from 'react';
import { useTrainer } from '@/context/TrainerContext';

type NavEntry = {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Paths that keep this entry highlighted. */
  matches: string[];
};

const NAVIGATION: NavEntry[] = [
  {
    path: '/',
    label: 'Talk',
    icon: MessageCircle,
    matches: ['/', '/conversation', '/coach', '/summary'],
  },
  { path: '/memory', label: 'Memory', icon: Bookmark, matches: ['/memory'] },
  { path: '/settings', label: 'Settings', icon: Settings, matches: ['/settings'] },
];

export function AppShell() {
  const { capture, practice, isSessionOpen, startOrResumePractice } = useTrainer();
  const navigationLocked =
    !capture.canChangeSession || practice.state.tag === 'waiting' || practice.isBusy;
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });

  function handleNavigate(item: NavEntry) {
    if (navigationLocked) return;
    // Talk returns to an open session instead of the start screen.
    if (item.path === '/' && isSessionOpen) {
      startOrResumePractice();
      return;
    }
    void navigate({ to: item.path });
  }

  return (
    <div className="app-shell">
      <nav aria-label="Main" className="app-sidebar">
        <div className="app-brand">English Trainer</div>
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          const active = item.matches.includes(currentPath);
          return (
            <button
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className="nav-item"
              disabled={navigationLocked}
              key={item.path}
              onClick={() => handleNavigate(item)}
              title={item.label}
              type="button"
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <main className="screen-content">
        <Outlet />
      </main>
    </div>
  );
}
