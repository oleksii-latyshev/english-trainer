import { useEffect, useRef, useState } from 'react';
import type { WarmSession } from './warm-session';

const LEVEL_UPDATE_MS = 100;

export function useMicrophoneActivity({
  session,
  enabled,
  detectSpeech,
  onSpeechStarted,
}: {
  session: WarmSession | null;
  enabled: boolean;
  detectSpeech: boolean;
  onSpeechStarted: () => void;
}): { level: number; canInterrupt: boolean } {
  const [level, setLevel] = useState(0);
  const callback = useRef(onSpeechStarted);
  callback.current = onSpeechStarted;
  const echoCancellationEnabled = session?.echoCancellationEnabled() === true;
  const canInterrupt = enabled && detectSpeech && echoCancellationEnabled;

  useEffect(() => {
    if (!enabled || !session) {
      setLevel(0);
      return;
    }

    let latestLevel = 0;
    let lastUpdateAt = 0;
    let animationFrame = 0;
    const stopOnsets = session.subscribeSpeechOnsets(
      { isEnabled: detectSpeech && session.echoCancellationEnabled() },
      () => callback.current(),
    );
    const stopLevels = session.subscribeLevels((next) => {
      latestLevel = next;
      if (animationFrame) return;
      animationFrame = requestAnimationFrame((timestamp) => {
        animationFrame = 0;
        if (timestamp - lastUpdateAt < LEVEL_UPDATE_MS) return;
        lastUpdateAt = timestamp;
        setLevel(latestLevel);
      });
    });

    return () => {
      stopOnsets();
      stopLevels();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [session, enabled, detectSpeech]);

  return { level, canInterrupt };
}
