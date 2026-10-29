import type { MicrophoneStatus } from '@/core/audio';
import { GrowthCard } from '@/features/eva-growth';
import { isSettingsPath, type SettingsSectionId } from '@/screens/settings';
import { NavItem } from '@/shared/ui/nav-item';
import { MicStatus } from './mic-status';
import {
  type DueCounts,
  dueOf,
  isCurrent,
  NAVIGATION,
  type NavEntry,
  navLabel,
} from './navigation';
import { SettingsSections } from './settings-sections';

type SidebarProps = {
  currentPath: string;
  activeSection: SettingsSectionId | undefined;
  dueCounts: DueCounts;
  navigationLocked: boolean;
  microphoneStatus: MicrophoneStatus;
  onNavigate: (item: NavEntry) => void;
  onOpenGrowth: () => void;
  onSettingsSection: (id: SettingsSectionId) => void;
};

function SidebarItem({
  item,
  currentPath,
  dueCounts,
  disabled,
  onNavigate,
}: {
  item: NavEntry;
  currentPath: string;
  dueCounts: DueCounts;
  disabled: boolean;
  onNavigate: (item: NavEntry) => void;
}) {
  const Icon = item.icon;
  const due = dueOf(item, dueCounts);
  return (
    <NavItem
      active={isCurrent(item, currentPath)}
      aria-label={navLabel(item, dueCounts)}
      badge={due > 0 ? { count: due, suffix: ' due' } : undefined}
      disabled={disabled}
      icon={<Icon size={18} strokeWidth={1.8} />}
      onClick={() => onNavigate(item)}
      title={item.label}
    >
      {item.label}
    </NavItem>
  );
}

export function Sidebar({
  currentPath,
  activeSection,
  dueCounts,
  navigationLocked,
  microphoneStatus,
  onNavigate,
  onOpenGrowth,
  onSettingsSection,
}: SidebarProps) {
  return (
    <nav
      aria-label="Main"
      className="rounded-card border-line bg-surface shadow-overlay backdrop-blur-glass max-rail:w-17 max-rail:px-2.5 flex w-55 flex-none flex-col gap-1.5 overflow-y-auto border px-3 py-4 backdrop-saturate-170"
    >
      <div className="max-rail:hidden px-2.5 pt-1 pb-3.5 text-lg font-bold tracking-tight">
        English Trainer
      </div>
      {NAVIGATION.map((item) => (
        <SidebarItem
          currentPath={currentPath}
          disabled={navigationLocked}
          dueCounts={dueCounts}
          item={item}
          key={item.path}
          onNavigate={onNavigate}
        />
      ))}
      {isSettingsPath(currentPath) && (
        <SettingsSections
          activeSection={activeSection}
          disabled={navigationLocked}
          onSelect={onSettingsSection}
        />
      )}
      <GrowthCard disabled={navigationLocked} onOpen={onOpenGrowth} />
      <MicStatus status={microphoneStatus} />
    </nav>
  );
}
