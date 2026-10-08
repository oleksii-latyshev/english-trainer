import { answeredByLabel } from '@/lib/answeredBy';
import type { TurnCoaching } from '@/lib/coachingTypes';
import type { PracticeDialogue } from '@/lib/dialogueTypes';

export type DialogueMessage = {
  id: string;
  sender: 'assistant' | 'learner';
  text: string;
  question?: string;
  inputSource?: 'voice' | 'edited' | 'text';
  /** Which model wrote this Eva message; absent for turns stored before it was recorded. */
  answeredBy?: string;
  /** The reply came from the on-device backup model after the main one stalled or failed. */
  isBackup?: boolean;
  /** Time to Eva's first words; absent for turns stored before it was recorded. */
  replyMs?: number;
  /** How long a spoken answer lasted; absent for typed answers and older turns. */
  answerDurationMs?: number;
  /** The learner opened a help level before sending this answer. */
  usedHelp?: boolean;
  /** Learner messages: which answer this is, counting from 1. */
  sequence?: number;
  /** Learner messages: where the background coaching of the answer stands. */
  coaching?: TurnCoaching;
};

function turnMessages(dialogue: PracticeDialogue, index: number): DialogueMessage[] {
  const turn = dialogue.turns[index];
  const messages: DialogueMessage[] = [];
  if (turn.learner.trim()) {
    messages.push({
      id: `msg-turn-${index}-learner`,
      sender: 'learner',
      text: turn.learner.trim(),
      inputSource: dialogue.input_sources?.[index],
      answerDurationMs: dialogue.answer_durations_ms?.[index] ?? undefined,
      usedHelp: dialogue.help_used?.[index] === true,
      sequence: index + 1,
      coaching: dialogue.coaching?.[index],
    });
  }
  const reply = turn.assistant_reply.trim();
  const question = turn.assistant_question.trim();
  if (reply || question) {
    messages.push({
      id: `msg-turn-${index}-assistant`,
      sender: 'assistant',
      text: reply,
      question: question || undefined,
      answeredBy: turn.answered_by ? answeredByLabel(turn.answered_by) : undefined,
      isBackup: turn.answered_by?.is_backup === true,
      replyMs: dialogue.reply_times_ms?.[index] ?? undefined,
    });
  }
  return messages;
}

function dialogueHistory(dialogue: PracticeDialogue): DialogueMessage[] {
  const messages: DialogueMessage[] = [];
  const opening = dialogue.opening_question.trim();
  if (opening) messages.push({ id: 'msg-opening', sender: 'assistant', text: opening });
  for (let index = 0; index < dialogue.turns.length; index++) {
    messages.push(...turnMessages(dialogue, index));
  }
  return messages;
}

function isQuestionShown(messages: DialogueMessage[], question: string): boolean {
  return messages.some(
    (message) =>
      message.sender === 'assistant' &&
      (message.text === question ||
        message.question === question ||
        `${message.text} ${message.question ?? ''}`.trim() === question),
  );
}

export function buildDialogueMessages(
  dialogue: PracticeDialogue | null,
  currentQuestion?: string,
): DialogueMessage[] {
  const question = currentQuestion?.trim();
  const messages = dialogue ? dialogueHistory(dialogue) : [];
  if (!question) return messages;
  if (!dialogue) {
    return [{ id: 'msg-fallback-prompt', sender: 'assistant', text: question }];
  }
  if (!isQuestionShown(messages, question)) {
    messages.push({ id: 'msg-current-prompt', sender: 'assistant', text: question });
  }
  return messages;
}
