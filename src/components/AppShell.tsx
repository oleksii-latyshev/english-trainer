import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Bookmark, MessageCircle, Settings } from 'lucide-react';
import type React from 'react';
import { useTrainer } from '@/context/TrainerContext';
import type { MicrophoneStatus } from '@/core/audio';
import { FIRST_RUN_PATH } from '@/core/first-run';
import {
  activeSettingsSection,
  EVA_SETTINGS_PATH,
  isSettingsPath,
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from '@/screens/settings';
import { NavItem } from '@/shared/ui/nav-item';
import { micStatusBox } from './lib/micStatusBox';
import { WordTranslationLayer } from './WordTranslationLayer';

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

function navLabel(item: NavEntry, dueCount: number): string {
  return item.path === '/memory' && dueCount > 0 ? `${item.label}, ${dueCount} due` : item.label;
}

function MicStatus({ status }: { status: MicrophoneStatus }) {
  const box = micStatusBox(status);
  return (
    <section
      aria-label="Microphone status"
      className="mt-auto flex flex-col gap-1.5 rounded-2xl border border-line-soft bg-quiet p-3 max-rail:hidden"
      role="status"
    >
      <div className="flex items-center gap-2 font-semibold text-caption text-quiet-foreground">
        <span
          aria-hidden="true"
          className={box.isOn ? 'size-2 rounded-full bg-warn' : 'size-2 rounded-full bg-faint'}
        />
        {box.title}
      </div>
      <div className="text-faint text-xs leading-snug">{box.hint}</div>
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
    <div className="flex h-dvh gap-3 overflow-hidden p-3 text-foreground">
      {!isFocusedPage && (
        <nav
          aria-label="Main"
          className="flex w-55 flex-none flex-col gap-1.5 overflow-y-auto rounded-card border border-line bg-surface px-3 py-4 shadow-overlay backdrop-blur-glass backdrop-saturate-170 max-rail:w-17 max-rail:px-2.5"
        >
          <div className="px-2.5 pt-1 pb-3.5 font-bold text-lg tracking-tight max-rail:hidden">
            English Trainer
          </div>
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            return (
              <NavItem
                active={item.matches.includes(currentPath)}
                aria-label={navLabel(item, dueCount)}
                badge={
                  item.path === '/memory' && dueCount > 0
                    ? { count: dueCount, suffix: ' due' }
                    : undefined
                }
                disabled={navigationLocked}
                icon={<Icon size={18} strokeWidth={1.8} />}
                key={item.path}
                onClick={() => handleNavigate(item)}
                title={item.label}
              >
                {item.label}
              </NavItem>
            );
          })}
          {isSettingsPath(currentPath) && (
            <div className="mt-4 flex flex-col pl-4.5 max-rail:hidden">
              {SETTINGS_SECTIONS.map((section) => (
                <NavItem
                  active={activeSection === section.id}
                  disabled={navigationLocked}
                  key={section.id}
                  level="sub"
                  onClick={() => handleSettingsSection(section.id)}
                >
                  {section.label}
                </NavItem>
              ))}
            </div>
          )}
          <MicStatus status={mic.status} />
        </nav>
      )}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-8 pb-16 max-rail:px-4 max-rail:pt-6 max-rail:pb-12 fills-screen:flex fills-screen:flex-col fills-screen:overflow-hidden fills-screen:p-0 sm:px-8 xl:px-12">
        <Outlet />
      </main>
      <WordTranslationLayer />
    </div>
  );
}
