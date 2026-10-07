import { Button } from '@heroui/react';
import type { ComposerVoice } from './lib/composerVoice';
import { listeningLabel, micStatusLabel } from './lib/composerVoice';

type Props = {
  voice: ComposerVoice;
  isRecording: boolean;
  handsFree: boolean;
  disabled: boolean;
};

function LevelMeter({ level }: { level: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, level)) * 100);
  return (
    <meter
      aria-label="Microphone level"
      className="composer-level"
      max={100}
      min={0}
      value={percent}
    />
  );
}

export function ListeningStatus({ voice, isRecording, handsFree, disabled }: Props) {
  const micOpen =
    voice.micStatus === 'opening' || voice.micStatus === 'warming' || voice.micStatus === 'ready';
  return (
    <div className="composer-listening">
      {isRecording ? (
        <>
          <span className="text-xs font-medium text-emerald-300" role="status">
            {listeningLabel(voice.mode)}
            {voice.held ? ' Holding the turn open.' : ''}
          </span>
          <LevelMeter level={voice.level} />
          {handsFree && (
            <Button
              aria-pressed={voice.held}
              className="secondary-action text-xs"
              onPress={() => voice.onHold(!voice.held)}
              size="sm"
            >
              {voice.held ? 'Done thinking' : 'Keep listening'}
            </Button>
          )}
        </>
      ) : (
        voice.micStatus !== 'unmanaged' &&
        voice.micStatus !== 'off' && (
          <span className="text-xs text-zinc-400" role="status">
            {voice.micError || micStatusLabel(voice.micStatus)}
          </span>
        )
      )}
      {!isRecording && micOpen && (
        <Button
          className="secondary-action text-xs"
          isDisabled={disabled}
          onPress={voice.onPauseMic}
          size="sm"
        >
          Pause mic
        </Button>
      )}
      {!isRecording && (voice.micStatus === 'paused' || voice.micStatus === 'error') && (
        <Button className="secondary-action text-xs" onPress={voice.onResumeMic} size="sm">
          Resume mic
        </Button>
      )}
    </div>
  );
}
