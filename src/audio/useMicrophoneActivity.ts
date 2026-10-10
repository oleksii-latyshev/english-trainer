import { useEffect, useRef, useState } from 'react';
import { signalMeterValue } from './audioSignal';
import { createInterruptSpeechDetector } from './microphoneActivity';
import type { MicrophoneSession } from './microphoneSession';

export function useMicrophoneActivity({
  session,
  enabled,
  detectSpeech,
  onSpeechStarted,
}: {
  session: MicrophoneSession | null;
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
    const interruptDetector = createInterruptSpeechDetector({
      isEnabled: detectSpeech && session.echoCancellationEnabled(),
      noiseFloor: session.noiseFloor(),
      onSpeechStarted: () => callback.current(),
    });
    const unsubscribe = session.subscribeFrames((frame) => {
      latestLevel = signalMeterValue(frame.rms);
      interruptDetector.push(frame);
      if (animationFrame) return;
      animationFrame = requestAnimationFrame((timestamp) => {
        animationFrame = 0;
        if (timestamp - lastUpdateAt < 100) return;
        lastUpdateAt = timestamp;
        setLevel(latestLevel);
      });
    });

    return () => {
      unsubscribe();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [session, enabled, detectSpeech]);

  return { level, canInterrupt };
}
