import { RegistryContext, useAtomMount, useAtomValue } from '@effect/atom-react';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { AsyncResult } from 'effect/reactivity';
import { useContext } from 'react';
import { canChangeSessionAtom } from '@/core/answer-capture';
import { microphoneSnapshotAtom } from '@/core/audio';
import { FIRST_RUN_PATH } from '@/core/first-run';
import { dueMemory, learningMemoryAtom } from '@/core/learning-memory';
import { dueMistakeCountAtom, mistakesUpdatesAtom } from '@/core/mistakes';
import {
  isSessionBusyAtom,
  isSessionOpenAtom,
  practiceStateAtom,
  startOrResumePractice,
} from '@/core/practice-session';
import { isTranslatablePath, TranslationLayer } from '@/features/text-translation';
import { GROWTH_PATH } from '@/screens/growth';
import {
  activeSettingsSection,
  EVA_SETTINGS_PATH,
  type SettingsSectionId,
} from '@/screens/settings';
import type { DueCounts, NavEntry } from './navigation';
import { Sidebar } from './sidebar';

function useNavigationLocked(): boolean {
  const canChangeSession = useAtomValue(canChangeSessionAtom);
  const practiceTag = useAtomValue(practiceStateAtom).tag;
  const isBusy = useAtomValue(isSessionBusyAtom);
  return !canChangeSession || practiceTag === 'waiting' || isBusy;
}

function useDueCounts(): DueCounts {
  const due = dueMemory(useAtomValue(learningMemoryAtom));
  const mistakes = useAtomValue(dueMistakeCountAtom);
  return { memory: due.tag === 'ready' ? due.dueCount : 0, mistakes };
}

function useShellNavigation(navigationLocked: boolean) {
  const registry = useContext(RegistryContext);
  const isSessionOpen = useAtomValue(isSessionOpenAtom);
  const navigate = useNavigate();

  function handleNavigate(item: NavEntry) {
    if (navigationLocked) return;
    if (item.path === '/' && isSessionOpen) {
      startOrResumePractice(registry, () => void navigate({ to: '/conversation' }));
      return;
    }
    void navigate({ to: item.path });
  }

  function handleOpenGrowth() {
    if (navigationLocked) return;
    void navigate({ to: GROWTH_PATH });
  }

  function handleSettingsSection(id: SettingsSectionId) {
    if (navigationLocked) return;
    if (id === 'eva') {
      void navigate({ to: EVA_SETTINGS_PATH });
      return;
    }
    void navigate({ to: '/settings', hash: id });
  }

  return { handleNavigate, handleOpenGrowth, handleSettingsSection };
}

export function AppShell() {
  useAtomMount(mistakesUpdatesAtom);
  const dueCounts = useDueCounts();
  const microphone = AsyncResult.getOrElse(useAtomValue(microphoneSnapshotAtom), () => ({
    status: 'off' as const,
  }));
  const navigationLocked = useNavigationLocked();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const currentHash = useRouterState({ select: (state) => state.location.hash });
  const { handleNavigate, handleOpenGrowth, handleSettingsSection } =
    useShellNavigation(navigationLocked);
  const isFocusedPage = currentPath === '/summary' || currentPath === FIRST_RUN_PATH;

  return (
    <div className="text-foreground flex h-dvh gap-3 overflow-hidden p-3">
      {!isFocusedPage && (
        <Sidebar
          activeSection={activeSettingsSection(currentPath, currentHash)}
          currentPath={currentPath}
          dueCounts={dueCounts}
          microphoneStatus={microphone.status}
          navigationLocked={navigationLocked}
          onNavigate={handleNavigate}
          onOpenGrowth={handleOpenGrowth}
          onSettingsSection={handleSettingsSection}
        />
      )}
      <main className="fills-screen:flex fills-screen:flex-col fills-screen:overflow-hidden fills-screen:p-0 max-rail:px-4 max-rail:pt-6 max-rail:pb-12 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-8 pb-16 sm:px-8 xl:px-12">
        <Outlet />
      </main>
      {isTranslatablePath(currentPath) && <TranslationLayer key={currentPath} />}
    </div>
  );
}
