import type { AnswerTarget, DebriefWord, ReviewedConversation, TurnCoaching } from '../../types';

export type DebriefCard = {
  readonly target: AnswerTarget;
  readonly question: string;
  readonly said: string;
  readonly coaching: TurnCoaching | undefined;
  readonly offered: readonly DebriefWord[];
  readonly wins: readonly string[];
};

function questionBefore(conversation: ReviewedConversation, index: number): string {
  const question =
    index === 0
      ? conversation.opening_question
      : (conversation.turns[index - 1]?.assistant_question ?? '');
  return question.trim();
}

export function debriefCards(conversation: ReviewedConversation): readonly DebriefCard[] {
  return conversation.turns.flatMap((turn, index) => {
    const said = turn.learner.trim();
    if (said === '') return [];
    const sequence = index + 1;
    return [
      {
        target: { sessionId: conversation.session_id, sequence },
        question: questionBefore(conversation, index),
        said,
        coaching: conversation.coaching[index],
        offered: conversation.debrief_words.filter((word) => word.sequence === sequence),
        wins: conversation.debrief_wins
          .filter((win) => win.sequence === sequence)
          .map((win) => win.phrase),
      },
    ];
  });
}
