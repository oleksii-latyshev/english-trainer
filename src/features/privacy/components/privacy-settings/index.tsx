import { useAtomSet, useAtomValue } from '@effect/atom-react';
import { Option } from 'effect';
import { AsyncResult } from 'effect/reactivity';
import { Button } from '@/shared/ui/button';
import { FormRow } from '@/shared/ui/form-row';
import { GroupCard } from '@/shared/ui/group-card';
import { Notice } from '@/shared/ui/notice';
import { Switch } from '@/shared/ui/switch';
import { privacyProblemMessage, RETENTION_UNREADABLE } from '../../helpers/privacy-problem';
import { keepRawAudioText, keptRecordingsText } from '../../helpers/recordings-text';
import {
  deleteKeptRecordingsAtom,
  privacyProblemAtom,
  retentionAtom,
  setKeepRawAudioAtom,
} from '../../model/atoms';
import type { Retention } from '../../types';

function RetentionRows({ retention }: { retention: Retention }) {
  const setKeepRawAudio = useAtomSet(setKeepRawAudioAtom);
  const deleteKept = useAtomSet(deleteKeptRecordingsAtom);
  return (
    <>
      <FormRow description={keepRawAudioText(retention.keepsAudio)} title="Keep raw audio">
        <Switch
          checked={retention.keepsAudio}
          isLabelHidden
          label="Keep raw audio"
          onCheckedChange={setKeepRawAudio}
        />
      </FormRow>
      <FormRow description={keptRecordingsText(retention.kept)} title="Kept recordings">
        <Button
          disabled={retention.kept.count === 0}
          onClick={() => deleteKept(undefined)}
          tone="ghost"
        >
          Delete kept recordings
        </Button>
      </FormRow>
    </>
  );
}

export function PrivacySettings() {
  const retention = useAtomValue(retentionAtom);
  const problem = useAtomValue(privacyProblemAtom);
  return (
    <GroupCard id="privacy" title="Privacy">
      <FormRow
        description="Speech recognition, your history, Memory, session numbers."
        title="Stays on this Mac"
      />
      <FormRow
        description="The text of your answers and Eva's recent replies — never audio."
        title="Sent to the AI"
      />
      {AsyncResult.match(retention, {
        onInitial: () => (
          <Notice role="status" tone="quiet">
            Loading…
          </Notice>
        ),
        onFailure: () => (
          <Notice role="alert" tone="error">
            {RETENTION_UNREADABLE}
          </Notice>
        ),
        onSuccess: ({ value }) => <RetentionRows retention={value} />,
      })}
      {Option.isSome(problem) && (
        <Notice role="alert" tone="error">
          {privacyProblemMessage(problem.value)}
        </Notice>
      )}
    </GroupCard>
  );
}
