import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  BarChart3,
  Brain,
  Briefcase,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Target,
  Zap,
} from 'lucide-react';
import type React from 'react';

function pathToTitle(pathname: string): string {
  switch (pathname) {
    case '/':
      return 'Daily Practice';
    case '/conversation':
      return 'Conversation';
    case '/coach':
      return 'Coach & Re-Speaking';
    case '/interview':
      return 'The Hot Seat (Interview)';
    case '/drills':
      return 'Skill Builders & Drills';
    case '/memory':
      return 'Learning Memory';
    case '/progress':
      return 'Progress & Benchmarks';
    case '/settings':
      return 'Settings & Hardware';
    case '/summary':
      return 'Session Complete';
    default:
      return 'Daily Practice';
  }
}

type NavEntry = {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const PRACTICE_MODES: NavEntry[] = [
  { path: '/', label: 'Daily Practice', icon: LayoutDashboard },
  { path: '/conversation', label: 'Conversation', icon: MessageSquare },
  { path: '/coach', label: 'Coach Mode', icon: Target },
  { path: '/interview', label: 'The Hot Seat', icon: Briefcase },
  { path: '/drills', label: 'Skill Drills', icon: Zap },
];

function NavButton({
  item,
  active,
  onNavigate,
}: {
  item: NavEntry;
  active: boolean;
  onNavigate: (to: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={`nav-item ${active ? 'nav-item--active' : ''}`}
      onClick={() => onNavigate(item.path)}
      type="button"
    >
      <div className="nav-item-left">
        <span className="nav-item-icon">
          <Icon className="h-4 w-4" />
        </span>
        <span className="nav-item-label">{item.label}</span>
      </div>
      {item.badge && <span className="nav-badge">{item.badge}</span>}
    </button>
  );
}

function AppHeader({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (to: string) => void;
}) {
  return (
    <header className="app-header">
      <div className="flex items-center">
        {/* macOS Traffic Lights */}
        <div className="window-controls">
          <span className="traffic-light traffic-light--close" />
          <span className="traffic-light traffic-light--minimize" />
          <span className="traffic-light traffic-light--maximize" />
        </div>

        <div className="window-title-area">
          <span className="brand">English Trainer</span>
          <span className="brand-badge">v0.1</span>
          <span className="text-zinc-600">›</span>
          <span className="header-context">{pathToTitle(currentPath)}</span>
        </div>
      </div>

      <div className="header-right">
        {/* Mini Eva Header Capsule */}
        <button
          className="eva-header-capsule"
          onClick={() => onNavigate('/memory')}
          title="Mini Eva: Level 3 Companion · Click for Learning Memory"
          type="button"
        >
          <span className="eva-capsule-avatar">🌱</span>
          <span className="eva-capsule-label">Mini Eva Lv.3</span>
          <span className="eva-capsule-xp">240 XP</span>
        </button>

        {/* Quick Settings Action */}
        <button
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          onClick={() => onNavigate('/settings')}
          title="Open Settings & Hardware"
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
}: {
  currentPath: string;
  onNavigate: (to: string) => void;
}) {
  return (
    <nav aria-label="Main navigation" className="app-sidebar">
      <p className="sidebar-label">PRACTICE MODES</p>
      {PRACTICE_MODES.map((item) => (
        <NavButton
          active={currentPath === item.path}
          item={item}
          key={item.path}
          onNavigate={onNavigate}
        />
      ))}

      <p className="sidebar-label">KNOWLEDGE</p>
      <NavButton
        active={currentPath === '/memory'}
        item={{ path: '/memory', label: 'Learning Memory', icon: Brain, badge: '18 due' }}
        onNavigate={onNavigate}
      />

      <p className="sidebar-label">ANALYTICS</p>
      <NavButton
        active={currentPath === '/progress'}
        item={{ path: '/progress', label: 'Progress', icon: BarChart3 }}
        onNavigate={onNavigate}
      />

      <div className="sidebar-spacer" />

      <p className="sidebar-label">SYSTEM</p>
      <NavButton
        active={currentPath === '/settings'}
        item={{ path: '/settings', label: 'Settings & Audio', icon: Settings }}
        onNavigate={onNavigate}
      />
    </nav>
  );
}

function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-item">
        <span className="footer-dot" />
        <span>MacBook Mic (16 kHz Mono)</span>
      </div>

      <div className="footer-item">
        <span>Whisper: Base.en (Metal ⚡ 14ms)</span>
      </div>

      <div className="footer-item">
        <kbd className="footer-hotkey">Space</kbd>
        <span>Hold to Speak</span>
      </div>
    </footer>
  );
}

export function AppShell() {
  const routerState = useRouterState();
  const navigate = useNavigate();
  const currentPath = routerState.location.pathname;

  function handleNavigate(to: string) {
    void navigate({ to });
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <AppHeader currentPath={currentPath} onNavigate={handleNavigate} />

        <div className="app-layout">
          <AppSidebar currentPath={currentPath} onNavigate={handleNavigate} />

          <main className="screen-content">
            <Outlet />
          </main>
        </div>

        <AppFooter />
      </div>
    </div>
  );
}
