import { Result } from 'effect';
import { DEFAULT_EVA_LOOK, type EvaLook } from '../../palette';
import { parseEvaLook } from '../parse-eva-look';

export const EVA_LOOK_KEY = 'english_trainer_eva_look';

function readRaw(): string | null {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(EVA_LOOK_KEY);
}

function parseStored(raw: string | null): EvaLook {
  return raw === null ? DEFAULT_EVA_LOOK : parseEvaLook(JSON.parse(raw));
}

export function readStoredEvaLook(): EvaLook {
  return Result.getOrElse(
    Result.try(() => parseStored(readRaw())),
    () => DEFAULT_EVA_LOOK,
  );
}

export function storeEvaLook(look: EvaLook): void {
  Result.try(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EVA_LOOK_KEY, JSON.stringify(look));
    }
  });
}
