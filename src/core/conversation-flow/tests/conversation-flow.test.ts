import { expect, it } from 'bun:test';
import { AtomRegistry } from 'effect/reactivity';
import { installFakeLocalStorage } from '@/shared/testing/fake-local-storage';
import { DEFAULT_CONVERSATION_FLOW } from '../conversation-flow';

const stored = installFakeLocalStorage({
  english_trainer_conversation_flow: JSON.stringify({
    autoListen: false,
    handsFree: false,
    endPauseMs: 1500,
    autoSendDelayMs: 99,
  }),
});

it('reads a value saved by an older version and fills what it never stored', async () => {
  const { conversationFlowAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  expect(registry.get(conversationFlowAtom)).toEqual({
    ...DEFAULT_CONVERSATION_FLOW,
    autoListen: false,
    handsFree: false,
    autoSendDelayMs: 99,
  });
});

it('persists a change in the stored shape', async () => {
  const { conversationFlowAtom } = await import('../model/atoms');
  const registry = AtomRegistry.make();
  registry.set(conversationFlowAtom, { ...DEFAULT_CONVERSATION_FLOW, endPauseMs: 2000 });
  expect(registry.get(conversationFlowAtom).endPauseMs).toBe(2000);
  expect(JSON.parse(stored.get('english_trainer_conversation_flow') ?? '{}').endPauseMs).toBe(2000);
});

it('lets non-React code read the value the atom holds', async () => {
  const { appRegistry } = await import('@/core/runtime');
  const { conversationFlowAtom } = await import('../model/atoms');
  const { readConversationFlow } = await import('../model/read-conversation-flow');
  appRegistry.set(conversationFlowAtom, { ...DEFAULT_CONVERSATION_FLOW, handsFree: false });
  expect(readConversationFlow().handsFree).toBe(false);
});
