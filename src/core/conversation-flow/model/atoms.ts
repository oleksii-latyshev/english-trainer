import { Atom } from 'effect/reactivity';
import { DEFAULT_CONVERSATION_FLOW } from '../conversation-flow';
import { ConversationFlowSchema } from '../helpers/conversation-flow-schema';
import { conversationFlowRuntime } from './runtime';

const CONVERSATION_FLOW_KEY = 'english_trainer_conversation_flow';

export const conversationFlowAtom = Atom.kvs({
  runtime: conversationFlowRuntime,
  key: CONVERSATION_FLOW_KEY,
  schema: ConversationFlowSchema,
  defaultValue: () => DEFAULT_CONVERSATION_FLOW,
  mode: 'sync',
});
