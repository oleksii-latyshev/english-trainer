import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/screens/settings';
import { NavItem } from '@/shared/ui/nav-item';

type SettingsSectionsProps = {
  activeSection: SettingsSectionId | undefined;
  disabled: boolean;
  onSelect: (id: SettingsSectionId) => void;
};

export function SettingsSections({ activeSection, disabled, onSelect }: SettingsSectionsProps) {
  return (
    <div className="mt-4 flex flex-col pl-4.5 max-rail:hidden">
      {SETTINGS_SECTIONS.map((section) => (
        <NavItem
          active={activeSection === section.id}
          disabled={disabled}
          key={section.id}
          level="sub"
          onClick={() => onSelect(section.id)}
        >
          {section.label}
        </NavItem>
      ))}
    </div>
  );
}
