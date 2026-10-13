import { AudioLines, Check, Mic } from 'lucide-react';
import type { AudioInputOption } from '@/core/audio';
import { IconTile } from '@/shared/ui/icon-tile';
import { LevelMeter } from '@/shared/ui/level-meter';
import { ListActionRow, ListFootnote, ListGroup, ListRow } from '@/shared/ui/list-group';
import { Select } from '@/shared/ui/select';
import { choiceOfDevice, deviceChoices, deviceOfChoice } from '../../helpers/device-choices';
import type { CheckStatus } from '../../helpers/heard-speech';

type Props = {
  deviceOptions: readonly AudioInputOption[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  hasUnnamed: boolean;
  isLocked: boolean;
  level: number | undefined;
  status: CheckStatus;
  onCheckAgain: () => void;
};

const HEARD_PROMPT = 'Say a sentence — for example, what you did this morning.';

export function CheckList({
  deviceOptions,
  selectedDeviceId,
  onSelectDevice,
  hasUnnamed,
  isLocked,
  level,
  status,
  onCheckAgain,
}: Props) {
  return (
    <>
      <ListGroup>
        <ListRow
          icon={
            <IconTile tone="red">
              <Mic />
            </IconTile>
          }
          title="Microphone"
          trailing={
            <Select
              disabled={isLocked}
              label="Input device"
              onChange={(choice) => onSelectDevice(deviceOfChoice(choice))}
              options={deviceChoices(deviceOptions, selectedDeviceId)}
              value={choiceOfDevice(selectedDeviceId)}
            />
          }
        />
        <ListRow
          icon={
            <IconTile tone="green">
              <AudioLines />
            </IconTile>
          }
          title="Input level"
          trailing={<LevelMeter label="Live microphone input level" level={level} />}
        />
        {!isLocked && <ListActionRow onClick={onCheckAgain}>Check again</ListActionRow>}
      </ListGroup>
      <ListFootnote className={status.ok ? 'text-ok-text' : undefined}>
        <span className="flex items-center gap-1.5" role="status">
          {status.ok && <Check aria-hidden="true" size={13} strokeWidth={2.4} />}
          {status.ok ? `${status.text}. ${HEARD_PROMPT}` : status.text}
        </span>
        {hasUnnamed && (
          <span className="mt-1 block">
            macOS hides microphone names until the first check; they appear after it.
          </span>
        )}
      </ListFootnote>
    </>
  );
}
