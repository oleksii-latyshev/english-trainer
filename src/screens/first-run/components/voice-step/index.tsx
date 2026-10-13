import { useAtomValue } from '@effect/atom-react';
import { previewingNaturalVoiceAtom } from '@/core/speech';
import { SystemVoices, type SystemVoicesProps, VoiceList } from '@/features/voice-settings';
import { StepLayout } from '../step-layout';

export function VoiceStep({ systemVoices }: { systemVoices: SystemVoicesProps }) {
  const previewing = useAtomValue(previewingNaturalVoiceAtom);
  return (
    <StepLayout mood={previewing === null ? 'happy' : 'speaking'} step="voice">
      <VoiceList systemVoices={<SystemVoices {...systemVoices} />} />
    </StepLayout>
  );
}
