import { SettingsGroup, SettingsRow } from './SettingsGroup';

export function PrivacySettings() {
  return (
    <SettingsGroup id="privacy" title="Privacy">
      <SettingsRow
        description="Speech recognition, your history, Memory, session numbers."
        title="Stays on this Mac"
      />
      <SettingsRow
        description="The text of your answers and Eva's recent replies — never audio."
        title="Sent to the AI"
      />
      <SettingsRow
        description="Always off for now: audio is deleted right after transcription. Saving recordings is not available yet."
        title="Keep raw audio"
      />
    </SettingsGroup>
  );
}
