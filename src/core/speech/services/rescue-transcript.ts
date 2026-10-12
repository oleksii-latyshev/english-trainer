import { Effect } from 'effect';
import { IpcError } from '@/core/ipc';
import { type RescueTurn, SpeechRecognition } from './speech-recognition-service';

export const NO_AUDIO_YET_MESSAGE = 'No audio is ready yet. Say a few words, then try Stuck again.';

export function rescueTranscript<E>(snapshot: Effect.Effect<Blob | null, E>, turn: RescueTurn) {
  return Effect.gen(function* () {
    const recognition = yield* SpeechRecognition;
    const wav = yield* snapshot;
    if (!wav) return yield* new IpcError({ code: 'no_speech', message: NO_AUDIO_YET_MESSAGE });
    return yield* recognition.transcribeRescue(wav, turn);
  });
}
