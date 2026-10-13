import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';

type Props = { url: string };

export function PlayBack({ url }: Props) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function handleToggle() {
    const element = audio.current;
    if (!element) return;
    if (isPlaying) {
      element.pause();
      element.currentTime = 0;
      return;
    }
    element.play().catch(() => setIsPlaying(false));
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: The learner's unsaved microphone check is never transcribed. */}
      <audio
        aria-label="Test microphone playback"
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        ref={audio}
        src={url}
      />
      <Button onClick={handleToggle} tone="ghost">
        {isPlaying ? 'Stop' : 'Play back'}
      </Button>
    </>
  );
}
