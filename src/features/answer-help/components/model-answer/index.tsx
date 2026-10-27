import { RegistryContext } from '@effect/atom-react';
import { Play } from 'lucide-react';
import { useContext } from 'react';
import { createPlayback } from '@/core/speech';
import { Button } from '@/shared/ui/button';

type Props = {
  text: string;
  isRecording: boolean;
  onHide: () => void;
};

export function ModelAnswer({ text, isRecording, onHide }: Props) {
  const playback = createPlayback(useContext(RegistryContext));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-faint text-xs">Model answer — try your own version after reading</div>
      <p className="text-body text-eva-text m-0 leading-relaxed">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={isRecording}
          onClick={() => playback.play(text)}
          size="sm"
          tone="secondary"
        >
          <Play aria-hidden="true" fill="currentColor" size={12} />
          Play
        </Button>
        <Button
          onClick={() => {
            playback.stop();
            onHide();
          }}
          size="sm"
          tone="quiet"
        >
          Hide before speaking
        </Button>
      </div>
    </div>
  );
}
