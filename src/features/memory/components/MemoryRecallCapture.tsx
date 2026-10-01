import { Button } from '@heroui/react';
import { useEffect, useRef, useState } from 'react';
import type { useSpeechCapture } from '@/features/speech/useSpeechCapture';

type Capture = ReturnType<typeof useSpeechCapture>;

type Props = {
  capture: Capture;
  isCaptureBusy: boolean;
  isFinishing: boolean;
  isSaving: boolean;
  onSaveRecall: () => void;
};

export function MemoryRecallCapture({
  capture,
  isCaptureBusy,
  isFinishing,
  isSaving,
  onSaveRecall,
}: Props) {
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const url = capture.view.playbackUrl;
    if (!url) return;
    const audio = new Audio(url);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
  }, [capture.view.playbackUrl]);

  async function playRecording() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setPlaybackError(null);
    try {
      await audio.play();
    } catch {
      setPlaybackError('Could not play this recording. You can still transcribe or record again.');
    }
  }

  if (capture.view.status === 'requesting') {
    return (
      <p role="status" className="text-sm text-zinc-300">
        Starting microphone…
      </p>
    );
  }
  if (capture.view.status === 'stopping') {
    return (
      <p role="status" className="text-sm text-zinc-300">
        Preparing recording…
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4">
      {capture.view.status === 'idle' && (
        <Button
          isDisabled={!capture.canChangeSession || isFinishing || isSaving}
          onPress={() => void capture.startRecording()}
          size="md"
          variant="primary"
        >
          Start recording
        </Button>
      )}
      {capture.view.status === 'recording' && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-rose-400">
            Recording ({Math.round(capture.view.elapsedMs / 1000)}s)
          </span>
          <Button
            className="border border-rose-500/30 text-rose-200"
            onPress={() => void capture.stopRecording()}
            size="sm"
            variant="secondary"
          >
            Stop recording
          </Button>
        </div>
      )}
      {capture.view.status === 'ready' && !capture.view.transcript && (
        <div className="flex flex-wrap items-center gap-2">
          {capture.view.playbackUrl && (
            <Button onPress={() => void playRecording()} size="sm" variant="secondary">
              Play recording
            </Button>
          )}
          <Button
            isDisabled={capture.view.transcribing || isSaving || isFinishing}
            onPress={() => void capture.transcribeRecording()}
            size="sm"
            variant="primary"
          >
            {capture.view.transcribing ? 'Transcribing…' : 'Transcribe'}
          </Button>
          <Button
            isDisabled={capture.view.transcribing || isSaving || isFinishing}
            onPress={capture.reset}
            size="sm"
            variant="secondary"
          >
            Record again
          </Button>
        </div>
      )}
      {playbackError && (
        <p role="alert" className="text-xs text-rose-300">
          {playbackError}
        </p>
      )}
      {capture.view.transcribing && (
        <p role="status" className="text-sm text-zinc-300">
          Transcribing locally…
        </p>
      )}
      {(capture.view.error || capture.view.transcriptionFailure) && (
        <div className="flex flex-col items-center gap-2" role="alert">
          <p className="m-0 text-xs text-rose-300">
            {capture.view.error || capture.view.transcriptionFailure?.message}
          </p>
          {capture.view.status === 'ready' &&
          capture.view.transcriptionFailure?.kind === 'retry' ? (
            <Button
              isDisabled={isCaptureBusy}
              onPress={() => void capture.transcribeRecording()}
              size="sm"
              variant="secondary"
            >
              Retry transcription
            </Button>
          ) : (
            <Button
              isDisabled={!capture.canChangeSession}
              onPress={capture.reset}
              size="sm"
              variant="secondary"
            >
              Try recording again
            </Button>
          )}
        </div>
      )}
      {capture.view.transcript && (
        <div className="flex w-full flex-col gap-3">
          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <span className="text-xs font-semibold text-zinc-400">Transcript preview</span>
            <p className="mt-1 mb-0 text-sm text-zinc-100">“{capture.view.transcript}”</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              isDisabled={isSaving || isFinishing || isCaptureBusy}
              onPress={capture.reset}
              size="sm"
              variant="secondary"
            >
              Record again
            </Button>
            <Button
              isDisabled={isSaving || isFinishing || isCaptureBusy}
              onPress={onSaveRecall}
              size="sm"
              variant="primary"
            >
              {isSaving ? 'Saving…' : 'Save recall'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
