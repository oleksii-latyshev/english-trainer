import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Brain, LayoutDashboard, MessageSquare, Settings, Target } from 'lucide-react';
import type React from 'react';
import { useTrainer } from '@/context/TrainerContext';

function pathToTitle(pathname: string): string {
  switch (pathname) {
    case '/':
      return 'Daily Practice';
    case '/conversation':
      return 'Conversation';
    case '/coach':
      return 'Coach & Re-Speaking';
    case '/memory':
      return 'Learning Memory';
    case '/progress':
      return 'Progress';
    case '/settings':
      return 'Settings';
    case '/summary':
      return 'Session Complete';
    case '/interview':
      return 'Interview practice';
    case '/drills':
      return 'Skill drills';
    default:
      return 'English Trainer';
  }
}

type NavEntry = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAVIGATION: NavEntry[] = [
  { path: '/', label: 'Daily Practice', icon: LayoutDashboard },
  { path: '/conversation', label: 'Conversation', icon: MessageSquare },
  { path: '/coach', label: 'Coach Mode', icon: Target },
  { path: '/memory', label: 'Learning Memory', icon: Brain },
];

function NavButton({
  item,
  active,
  onNavigate,
  navigationLocked,
}: {
  item: NavEntry;
  active: boolean;
  onNavigate: (to: string) => void;
  navigationLocked: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      disabled={navigationLocked}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      className={`nav-item ${active ? 'nav-item--active' : ''}`}
      onClick={() => onNavigate(item.path)}
      type="button"
    >
      <span className="nav-item-left">
        <span className="nav-item-icon">
          <Icon className="h-4 w-4" />
        </span>
        <span className="nav-item-label">{item.label}</span>
      </span>
    </button>
  );
}

function AppHeader({
  currentPath,
  onNavigate,
  navigationLocked,
}: {
  currentPath: string;
  onNavigate: (to: string) => void;
  navigationLocked: boolean;
}) {
  return (
    <header className="app-header">
      <div className="flex items-center">
        <div className="window-title-area">
          <span className="brand">English Trainer</span>
          <span className="brand-badge">v0.1</span>
          <span className="text-zinc-600">›</span>
          <span className="header-context">{pathToTitle(currentPath)}</span>
        </div>
      </div>
      <div className="header-right">
        <button
          disabled={navigationLocked}
          aria-label="Open settings"
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          onClick={() => onNavigate('/settings')}
          type="button"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function AppSidebar({
  currentPath,
  onNavigate,
  navigationLocked,
}: {
  currentPath: string;
  onNavigate: (to: string) => void;
  navigationLocked: boolean;
}) {
  return (
    <nav aria-label="Main navigation" className="app-sidebar">
      <div className="sidebar-practice">
        <p className="sidebar-label">PRACTICE</p>
        {NAVIGATION.map((item) => (
          <NavButton
            active={currentPath === item.path}
            item={item}
            key={item.path}
            onNavigate={onNavigate}
            navigationLocked={navigationLocked}
          />
        ))}
      </div>
      <p className="sidebar-label">SETTINGS</p>
      <NavButton
        active={currentPath === '/settings'}
        item={{ path: '/settings', label: 'Setup and voice', icon: Settings }}
        onNavigate={onNavigate}
        navigationLocked={navigationLocked}
      />
    </nav>
  );
}

export function AppShell() {
  const { capture, practice } = useTrainer();
  const navigationLocked =
    !capture.canChangeSession || practice.state.tag === 'waiting' || practice.isBusy;
  const routerState = useRouterState();
  const navigate = useNavigate();
  const currentPath = routerState.location.pathname;

  function handleNavigate(to: string) {
    if (!navigationLocked) void navigate({ to });
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <AppHeader
          currentPath={currentPath}
          onNavigate={handleNavigate}
          navigationLocked={navigationLocked}
        />
        <div className="app-layout">
          <AppSidebar
            currentPath={currentPath}
            onNavigate={handleNavigate}
            navigationLocked={navigationLocked}
          />
          <main className="screen-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
