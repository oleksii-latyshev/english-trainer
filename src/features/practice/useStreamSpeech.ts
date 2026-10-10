import { type MutableRefObject, useEffect, useRef, useState } from 'react';
import type { SpeechTiming } from '@/features/speech/TimingPanel';
import type { useSystemSpeech } from '@/features/speech/useSystemSpeech';
import { practiceStageUsesAudio } from './lib/practiceStage';
import type { SessionDetails } from './lib/practiceState';
import type { PracticeViewModel } from './practiceViewModel';

type Options = {
  speech: ReturnType<typeof useSystemSpeech>;
  generation: MutableRefObject<number>;
  listenAfterReply: (requestId: number) => void;
};

export function useStreamSpeech({ speech, generation, listenAfterReply }: Options) {
  const playback = useRef<ReturnType<typeof speech.beginStream> | null>(null);
  const [timing, setTiming] = useState<SpeechTiming>({});
  const [error, setError] = useState('');
  useEffect(() => () => playback.current?.cancel(), []);

  function begin({
    requestId,
    model,
    session,
    sentAtMs,
  }: {
    requestId: number;
    model: PracticeViewModel;
    session: SessionDetails;
    sentAtMs: number;
  }) {
    setTiming({ ...model.timing });
    setError('');
    let firstTokenMs: number | undefined;
    const voice = practiceStageUsesAudio(session)
      ? speech.beginStream({
          onStart: (latencyMs) => {
            if (requestId !== generation.current) return;
            const audioAtMs = performance.now();
            setTiming((current) => ({
              ...current,
              ttsStartMs: latencyMs,
              firstAiAudioMs:
                model.speechStoppedAtMs === undefined
                  ? undefined
                  : audioAtMs - model.speechStoppedAtMs,
              sendToAudioMs: audioAtMs - sentAtMs,
            }));
          },
          onError: () =>
            setError(
              'Eva’s voice could not play. The reply stays on screen; try Hear it or continue speaking.',
            ),
          onEnd: () => {
            if (session.isMistakePractice && session.turnCount + 1 >= session.targetTurns) return;
            // A fast voice can drain before React has rendered the completed IPC request.
            window.setTimeout(() => listenAfterReply(requestId), 0);
          },
        })
      : null;
    playback.current = voice;
    return {
      append(text: string) {
        if (firstTokenMs === undefined) {
          firstTokenMs = performance.now() - sentAtMs;
          setTiming((current) => ({ ...current, firstTokenMs }));
        }
        voice?.append(text);
      },
      finish(text: string) {
        setTiming((current) => ({ ...current, providerCompleteMs: performance.now() - sentAtMs }));
        voice?.finish(text);
      },
      cancel: () => voice?.cancel(),
    };
  }
  return { begin, timing, error, cancel: () => playback.current?.cancel() };
}
