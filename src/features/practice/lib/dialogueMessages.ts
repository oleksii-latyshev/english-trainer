import type { PracticeDialogue } from '@/lib/dialogueTypes';

export type DialogueMessage = {
  id: string;
  sender: 'assistant' | 'learner';
  text: string;
  question?: string;
  inputSource?: 'voice' | 'edited' | 'text';
};

export function buildDialogueMessages(
  dialogue: PracticeDialogue | null,
  currentQuestion?: string,
): DialogueMessage[] {
  const messages: DialogueMessage[] = [];

  if (dialogue) {
    if (dialogue.opening_question.trim()) {
      messages.push({
        id: 'msg-opening',
        sender: 'assistant',
        text: dialogue.opening_question.trim(),
      });
    }

    for (let i = 0; i < dialogue.turns.length; i++) {
      const turn = dialogue.turns[i];
      if (turn.learner.trim()) {
        messages.push({
          id: `msg-turn-${i}-learner`,
          sender: 'learner',
          text: turn.learner.trim(),
          inputSource: dialogue.input_sources?.[i],
        });
      }

      const reply = turn.assistant_reply.trim();
      const question = turn.assistant_question.trim();
      if (reply || question) {
        messages.push({
          id: `msg-turn-${i}-assistant`,
          sender: 'assistant',
          text: reply,
          question: question || undefined,
        });
      }
    }
  } else if (currentQuestion?.trim()) {
    messages.push({
      id: 'msg-fallback-prompt',
      sender: 'assistant',
      text: currentQuestion.trim(),
    });
  }

  if (currentQuestion?.trim()) {
    const trimmed = currentQuestion.trim();
    const alreadyPresent = messages.some(
      (m) =>
        m.sender === 'assistant' &&
        (m.text === trimmed ||
          m.question === trimmed ||
          `${m.text} ${m.question ?? ''}`.trim() === trimmed),
    );

    if (!alreadyPresent) {
      messages.push({
        id: 'msg-current-prompt',
        sender: 'assistant',
        text: trimmed,
      });
    }
  }

  return messages;
}
