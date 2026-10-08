// @ts-expect-error Bun's test API is available to the runner but not declared in the app's TypeScript config.
import { describe, expect, it } from 'bun:test';
import { buildDialogueMessages } from './dialogueMessages';

describe('buildDialogueMessages', () => {
  it('labels Eva replies with their origin and leaves old turns unlabelled', () => {
    const msgs = buildDialogueMessages({
      session_id: 1,
      opening_question: 'Hi?',
      turns: [
        {
          learner: 'A',
          assistant_reply: 'Ok.',
          assistant_question: 'Why?',
          answered_by: { provider: 'apple', model: 'apple-foundation-models', is_backup: true },
        },
        { learner: 'B', assistant_reply: 'Fine.', assistant_question: 'How?', answered_by: null },
      ],
    });
    const eva = msgs.filter((m) => m.id.endsWith('-assistant'));
    expect(eva[0].answeredBy).toBe('Apple on-device (backup)');
    expect(eva[1].answeredBy).toBeUndefined();
    expect(eva[0].isBackup).toBe(true);
    expect(eva[1].isBackup).toBe(false);
  });

  it('carries reply time, answer duration and help use per turn and leaves old turns bare', () => {
    const msgs = buildDialogueMessages({
      session_id: 1,
      opening_question: 'Hi?',
      turns: [
        { learner: 'A', assistant_reply: 'Ok.', assistant_question: 'Why?' },
        { learner: 'B', assistant_reply: 'Fine.', assistant_question: 'How?' },
      ],
      input_sources: ['voice', 'text'],
      reply_times_ms: [800, null],
      answer_durations_ms: [14_000, null],
      help_used: [true, false],
    });
    const learner = msgs.filter((m) => m.sender === 'learner');
    const eva = msgs.filter((m) => m.id.endsWith('-assistant'));
    expect(learner[0].answerDurationMs).toBe(14_000);
    expect(learner[0].usedHelp).toBe(true);
    expect(learner[1].answerDurationMs).toBeUndefined();
    expect(learner[1].usedHelp).toBe(false);
    expect(eva[0].replyMs).toBe(800);
    expect(eva[1].replyMs).toBeUndefined();
  });

  it('renders fallback prompt when dialogue is null', () => {
    const msgs = buildDialogueMessages(null, 'What did you do today?');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toEqual({
      id: 'msg-fallback-prompt',
      sender: 'assistant',
      text: 'What did you do today?',
    });
  });

  it('omits duplicate when current question matches opening question', () => {
    const msgs = buildDialogueMessages(
      {
        session_id: 1,
        opening_question: 'What did you do today?',
        turns: [],
      },
      'What did you do today?',
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('What did you do today?');
    expect(msgs[0].id).toBe('msg-opening');
  });

  it('omits the empty reply of an answer an older Coach session never continued', () => {
    const msgs = buildDialogueMessages(
      {
        session_id: 1,
        opening_question: 'Introduce yourself.',
        turns: [
          {
            learner: 'I am a software engineer.',
            assistant_reply: '',
            assistant_question: '',
          },
        ],
      },
      'Introduce yourself.',
    );
    // Opening question + learner turn. Assistant turn omitted because reply and question are empty.
    expect(msgs).toHaveLength(2);
    expect(msgs[0].sender).toBe('assistant');
    expect(msgs[0].text).toBe('Introduce yourself.');
    expect(msgs[1].sender).toBe('learner');
    expect(msgs[1].text).toBe('I am a software engineer.');
  });

  it('renders completed turns in order with learner then assistant', () => {
    const msgs = buildDialogueMessages(
      {
        session_id: 1,
        opening_question: 'Introduce yourself.',
        turns: [
          {
            learner: 'I am a software engineer.',
            assistant_reply: 'Nice to meet you!',
            assistant_question: 'What technologies do you use?',
          },
        ],
      },
      'What technologies do you use?',
    );
    // Opening + learner + assistant. Since current question matches assistant_question, no duplicate.
    expect(msgs).toHaveLength(3);
    expect(msgs[0].sender).toBe('assistant');
    expect(msgs[1].sender).toBe('learner');
    expect(msgs[2].sender).toBe('assistant');
    expect(msgs[2].text).toBe('Nice to meet you!');
    expect(msgs[2].question).toBe('What technologies do you use?');
  });

  it('appends current question when it is a new prompt not yet in history', () => {
    const msgs = buildDialogueMessages(
      {
        session_id: 1,
        opening_question: 'Introduce yourself.',
        turns: [
          {
            learner: 'I am an engineer.',
            assistant_reply: 'Cool!',
            assistant_question: '',
          },
        ],
      },
      'What do you like about it?',
    );
    // Opening + learner + assistant + new current prompt
    expect(msgs).toHaveLength(4);
    expect(msgs[3].id).toBe('msg-current-prompt');
    expect(msgs[3].text).toBe('What do you like about it?');
  });

  it('numbers each learner answer and carries where its coaching stands', () => {
    const msgs = buildDialogueMessages({
      session_id: 1,
      opening_question: 'Q?',
      turns: [
        { learner: 'First', assistant_reply: 'Ok.', assistant_question: 'And?' },
        { learner: 'Second', assistant_reply: 'Ok.', assistant_question: 'Why?' },
      ],
      coaching: [{ state: 'failed' }, { state: 'pending' }],
    });
    const learner = msgs.filter((message) => message.sender === 'learner');
    expect(learner.map((message) => message.sequence)).toEqual([1, 2]);
    expect(learner.map((message) => message.coaching?.state)).toEqual(['failed', 'pending']);
    expect(msgs.filter((message) => message.sender === 'assistant')[0].sequence).toBeUndefined();
  });
});
