import type { InputSource } from './inputSource';
import { spokenDurationMs } from './messageMeta';
import { canSendPracticeSource } from './practiceStage';
import type { SessionDetails } from './practiceState';

export function preparePracticeTurn({
  canSend,
  session,
  customText,
  transcript,
  source,
  durationMs,
}: {
  canSend: boolean;
  session: SessionDetails | undefined;
  customText: string | undefined;
  transcript: string | undefined;
  source: InputSource | undefined;
  durationMs: number;
}) {
  if (!canSend || !session) throw new Error('The current answer cannot be sent yet.');
  const text = customText ?? transcript;
  const inputSource = source ?? 'text';
  if (!canSendPracticeSource(session, inputSource))
    throw new Error('This answer does not match the current practice stage.');
  if (!text?.trim()) throw new Error('The answer is empty.');
  return { session, text, inputSource, spokenMs: spokenDurationMs(source, durationMs) };
}
