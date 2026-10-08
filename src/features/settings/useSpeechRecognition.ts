import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSpeechCheck,
  getSpeechSettings,
  listSpeechModels,
  type SpeechCheckStatus,
  type SpeechModels,
  type SpeechSettings,
  speechErrorMessage,
} from '@/lib/speechTypes';

export type SpeechRecognitionData = {
  settings: SpeechSettings;
  models: SpeechModels;
  check: SpeechCheckStatus;
};

export type SpeechRecognitionState =
  | { tag: 'loading' }
  | { tag: 'ready'; data: SpeechRecognitionData }
  | { tag: 'error'; message: string };

/** Loads everything the "Speech recognition" group shows; `update` applies a change from a command's reply. */
export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechRecognitionState>({ tag: 'loading' });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const [settings, models, check] = await Promise.all([
        getSpeechSettings(),
        listSpeechModels(),
        getSpeechCheck(),
      ]);
      if (request === generation.current)
        setState({ tag: 'ready', data: { settings, models, check } });
    } catch (cause) {
      if (request === generation.current) {
        setState({
          tag: 'error',
          message: speechErrorMessage(cause, 'Speech recognition settings could not be read.'),
        });
      }
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      generation.current += 1;
    };
  }, [load]);

  function update(change: Partial<SpeechRecognitionData>) {
    setState((current) =>
      current.tag === 'ready' ? { tag: 'ready', data: { ...current.data, ...change } } : current,
    );
  }

  return { state, reload: load, update };
}
