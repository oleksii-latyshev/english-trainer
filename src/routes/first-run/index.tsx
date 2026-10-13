import { useAtomSet } from '@effect/atom-react';
import { useNavigate } from '@tanstack/react-router';
import { useTrainer } from '@/context/TrainerContext';
import { firstRunMarkerAtom } from '@/core/first-run';
import { FirstRunScreen } from '@/screens/first-run';

export function FirstRunRoute() {
  const { capture, speech } = useTrainer();
  const navigate = useNavigate();
  const setMarker = useAtomSet(firstRunMarkerAtom);

  function leave(status: 'finished' | 'skipped') {
    setMarker({ status });
    void navigate({ to: '/' });
  }

  return (
    <FirstRunScreen
      isPracticeCapturing={!capture.canChangeSession}
      onBeforeMicrophoneCheck={speech.stop}
      onFinish={() => leave('finished')}
      onSkip={() => leave('skipped')}
    />
  );
}
