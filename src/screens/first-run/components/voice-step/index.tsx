import { useAtomValue } from '@effect/atom-react';
import { previewingNaturalVoiceAtom } from '@/core/speech';
import { VoiceList } from '@/features/voice-settings';
import { StepLayout } from '../step-layout';

export function VoiceStep() {
  const previewing = useAtomValue(previewingNaturalVoiceAtom);
  return (
    <StepLayout mood={previewing === null ? 'happy' : 'speaking'} step="voice">
      <VoiceList />
    </StepLayout>
  );
}
