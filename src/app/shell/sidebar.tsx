import type { MicrophoneStatus } from '@/core/audio';
import { isSettingsPath, type SettingsSectionId } from '@/screens/settings';
import { NavItem } from '@/shared/ui/nav-item';
import { MicStatus } from './mic-status';
import { NAVIGATION, type NavEntry, navLabel } from './navigation';
import { SettingsSections } from './settings-sections';

type SidebarProps = {
  currentPath: string;
  activeSection: SettingsSectionId | undefined;
  dueCount: number;
  navigationLocked: boolean;
  microphoneStatus: MicrophoneStatus;
  onNavigate: (item: NavEntry) => void;
  onSettingsSection: (id: SettingsSectionId) => void;
};

function SidebarItem({
  item,
  currentPath,
  dueCount,
  disabled,
  onNavigate,
}: {
  item: NavEntry;
  currentPath: string;
  dueCount: number;
  disabled: boolean;
  onNavigate: (item: NavEntry) => void;
}) {
  const Icon = item.icon;
  return (
    <NavItem
      active={item.matches.includes(currentPath)}
      aria-label={navLabel(item, dueCount)}
      badge={
        item.path === '/memory' && dueCount > 0 ? { count: dueCount, suffix: ' due' } : undefined
      }
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
  dueCount,
  navigationLocked,
  microphoneStatus,
  onNavigate,
  onSettingsSection,
}: SidebarProps) {
  return (
    <nav
      aria-label="Main"
      className="flex w-55 flex-none flex-col gap-1.5 overflow-y-auto rounded-card border border-line bg-surface px-3 py-4 shadow-overlay backdrop-blur-glass backdrop-saturate-170 max-rail:w-17 max-rail:px-2.5"
    >
      <div className="px-2.5 pt-1 pb-3.5 font-bold text-lg tracking-tight max-rail:hidden">
        English Trainer
      </div>
      {NAVIGATION.map((item) => (
        <SidebarItem
          currentPath={currentPath}
          disabled={navigationLocked}
          dueCount={dueCount}
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
      <MicStatus status={microphoneStatus} />
    </nav>
  );
}
