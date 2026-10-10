import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
} from 'react';
import type { HelpLevel } from './lib/helpLevels';

type HelpSnapshot = { key: string; level: HelpLevel | null };

export function exampleCueWasInterrupted(
  wasCapturingAtRequest: boolean,
  requestCaptureEpoch: number,
  currentCaptureEpoch: number,
  isCapturing: boolean,
): boolean {
  return wasCapturingAtRequest || requestCaptureEpoch !== currentCaptureEpoch || isCapturing;
}

export function useExampleCaptureGuard({
  isCapturing,
  helpLevel,
  helpKey,
  helpRequest,
  requestedHelp,
  setHelp,
  stopSpeech,
}: {
  isCapturing: boolean;
  helpLevel: HelpLevel | null;
  helpKey: string;
  helpRequest: MutableRefObject<number>;
  requestedHelp: MutableRefObject<HelpLevel | null>;
  setHelp: Dispatch<SetStateAction<HelpSnapshot>>;
  stopSpeech: () => void;
}) {
  const isCapturingRef = useRef(isCapturing);
  isCapturingRef.current = isCapturing;
  const captureEpoch = useRef(0);
  const wasCapturing = useRef(false);
  const stopSpeechRef = useRef(stopSpeech);
  stopSpeechRef.current = stopSpeech;

  useEffect(() => {
    if (!isCapturing) {
      wasCapturing.current = false;
      return;
    }
    if (wasCapturing.current) return;
    wasCapturing.current = true;
    captureEpoch.current += 1;
    if (helpLevel !== 'example' && requestedHelp.current !== 'example') return;
    helpRequest.current += 1;
    requestedHelp.current = null;
    if (helpLevel !== 'example') return;
    setHelp({ key: helpKey, level: null });
    stopSpeechRef.current();
  }, [helpKey, helpLevel, helpRequest, isCapturing, requestedHelp, setHelp]);

  return { captureEpoch, isCapturingRef };
}
