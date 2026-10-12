import { expect, test } from 'bun:test';
import { createSpeechGate } from '.';

test('the gate opens once the level crosses the speech threshold and stays open', () => {
  const gate = createSpeechGate();
  gate.sample(0.001);
  expect(gate.hasHeardSpeech()).toBe(false);
  gate.sample(0.2);
  gate.sample(0);
  expect(gate.hasHeardSpeech()).toBe(true);
});
