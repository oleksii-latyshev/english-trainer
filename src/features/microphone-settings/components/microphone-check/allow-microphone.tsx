import { Mic } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ListFootnote } from '@/shared/ui/list-group';

type Props = { isDisabled: boolean; isPreparing: boolean; onAllow: () => void };

export function AllowMicrophone({ isDisabled, isPreparing, onAllow }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Button disabled={isDisabled} onClick={onAllow} pending={isPreparing} tone="primary">
        <Mic aria-hidden="true" />
        {isPreparing ? 'Preparing the microphone…' : 'Allow Microphone'}
      </Button>
      <ListFootnote>macOS will ask for permission once.</ListFootnote>
    </div>
  );
}
