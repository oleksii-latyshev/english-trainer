import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Bookmark, MessageCircle, Settings } from 'lucide-react';
import type React from 'react';
import type { MicrophoneStatus } from '@/audio/microphoneManager';
import { useTrainer } from '@/context/TrainerContext';
import { FIRST_RUN_PATH } from '@/lib/firstRun';
import {
  activeSettingsSection,
  EVA_SETTINGS_PATH,
  isSettingsPath,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from '@/lib/settingsSections';
import { micStatusBox } from './lib/micStatusBox';

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
  { path: '/memory', label: 'Memory', icon: Bookmark, matches: ['/memory', '/memory/review'] },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    matches: ['/settings', EVA_SETTINGS_PATH],
  },
];

function navLabel(item: NavEntry, dueCount: number): string {
  return item.path === '/memory' && dueCount > 0 ? `${item.label}, ${dueCount} due` : item.label;
}

function MicStatus({ status }: { status: MicrophoneStatus }) {
  const box = micStatusBox(status);
  return (
    <section aria-label="Microphone status" className="app-mic" role="status">
      <div className="app-mic-title">
        <span aria-hidden="true" className="app-mic-dot" data-on={box.isOn} />
        {box.title}
      </div>
      <div className="app-mic-hint">{box.hint}</div>
    </section>
  );
}

export function AppShell() {
  const { capture, practice, isSessionOpen, startOrResumePractice, mic, due } = useTrainer();
  const dueCount = due.tag === 'ready' ? due.dueCount : 0;
  const navigationLocked =
    !capture.canChangeSession || practice.state.tag === 'waiting' || practice.isBusy;
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const currentHash = useRouterState({ select: (state) => state.location.hash });

  function handleNavigate(item: NavEntry) {
    if (navigationLocked) return;
    // Talk returns to an open session instead of the start screen.
    if (item.path === '/' && isSessionOpen) {
      startOrResumePractice();
      return;
    }
    void navigate({ to: item.path });
  }

  function handleSettingsSection(id: SettingsSectionId) {
    if (navigationLocked) return;
    if (id === 'eva') {
      void navigate({ to: EVA_SETTINGS_PATH });
      return;
    }
    void navigate({ to: '/settings', hash: id });
  }

  const activeSection = activeSettingsSection(currentPath, currentHash);

  // The wrap-up and first run are focused pages of their own: no sidebar until the learner is done.
  const isFocusedPage = currentPath === '/summary' || currentPath === FIRST_RUN_PATH;

  return (
    <div className="app-shell">
      {!isFocusedPage && (
        <nav aria-label="Main" className="app-sidebar">
          <div className="app-brand">English Trainer</div>
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const active = item.matches.includes(currentPath);
            return (
              <button
                aria-current={active ? 'page' : undefined}
                aria-label={navLabel(item, dueCount)}
                className="nav-item"
                disabled={navigationLocked}
                key={item.path}
                onClick={() => handleNavigate(item)}
                title={item.label}
                type="button"
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="nav-item-label">{item.label}</span>
                {item.path === '/memory' && dueCount > 0 && (
                  <span aria-hidden="true" className="nav-badge">
                    <span className="nav-badge-count">{dueCount}</span>
                    <span className="nav-badge-text"> due</span>
                  </span>
                )}
              </button>
            );
          })}
          {isSettingsPath(currentPath) && (
            <div className="app-subnav">
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  aria-current={activeSection === section.id ? 'true' : undefined}
                  className="sub-item"
                  disabled={navigationLocked}
                  key={section.id}
                  onClick={() => handleSettingsSection(section.id)}
                  type="button"
                >
                  {section.label}
                </button>
              ))}
            </div>
          )}
          <MicStatus status={mic.status} />
        </nav>
      )}
      <main className="screen-content">
        <Outlet />
      </main>
    </div>
  );
}
