import { useAtomValue } from '@effect/atom-react';
import { AudioLines } from 'lucide-react';
import { conversationFlowAtom } from '@/core/conversation-flow';
import { Button } from '@/shared/ui/button';
import { Popover } from '@/shared/ui/popover';
import { FlowControls } from '../flow-controls';

export function FlowMenu() {
  const flow = useAtomValue(conversationFlowAtom);
  return (
    <Popover
      align="end"
      label="Conversation flow"
      trigger={
        <Button size="sm" tone="quiet">
          <AudioLines aria-hidden="true" />
          Hands-free
          <span className="text-caption text-muted">{flow.handsFree ? 'on' : 'off'}</span>
        </Button>
      }
    >
      <FlowControls />
    </Popover>
  );
}
