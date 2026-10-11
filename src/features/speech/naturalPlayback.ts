export type PlaybackCallbacks = { onStart: () => void; onEnd: () => void; onError: () => void };
export type Playback = { pause: () => void; resume: () => void; stop: () => void };

export function playWave(bytes: ArrayBuffer, callbacks: PlaybackCallbacks): Playback {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  const audio = new Audio(url);
  let active = true;
  const release = () => {
    if (!active) return;
    active = false;
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
  };
  const fail = () => {
    if (!active) return;
    release();
    callbacks.onError();
  };
  audio.onplaying = () => {
    if (active) callbacks.onStart();
  };
  audio.onended = () => {
    if (!active) return;
    release();
    callbacks.onEnd();
  };
  audio.onerror = fail;
  void audio.play().catch(fail);
  return {
    pause: () => {
      if (active) audio.pause();
    },
    resume: () => {
      if (active) void audio.play().catch(fail);
    },
    stop: release,
  };
}

export function playSystemSentence(
  text: string,
  voice: SpeechSynthesisVoice | null,
  rate: number,
  callbacks: PlaybackCallbacks,
): Playback {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = rate;
  let active = true;
  utterance.onstart = () => {
    if (active) callbacks.onStart();
  };
  utterance.onend = () => {
    if (active) callbacks.onEnd();
  };
  utterance.onerror = () => {
    if (active) callbacks.onError();
  };
  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    callbacks.onError();
  }
  return {
    pause: () => window.speechSynthesis.pause(),
    resume: () => window.speechSynthesis.resume(),
    stop: () => {
      active = false;
      window.speechSynthesis.cancel();
    },
  };
}
