import { expect, it } from 'bun:test';
import { Deferred, Effect, Layer } from 'effect';
import { AtomRegistry, Reactivity } from 'effect/reactivity';
import { Ipc, IpcDecodeError, IpcError } from '@/core/ipc';
import {
  draftAtom,
  lookupAtom,
  lookupCommandAtom,
  panelOpenAtom,
  selectionAtom,
} from '../model/atoms';
import {
  changeDraft,
  closePanel,
  openPanel,
  retryExplanation,
  submitDraft,
  translateSelection,
} from '../model/commands';
import { runtime } from '../model/runtime';
import { TextTranslationService } from '../services/text-translation-service';

type Gate = Deferred.Deferred<void>;

type FakeRust = {
  readonly calls: Array<{ readonly command: string; readonly args: unknown }>;
  readonly translationGates: Map<string, Gate>;
  readonly explanationGates: Map<string, Gate>;
  readonly failingTranslations: Map<string, IpcError>;
  failingExplanations: number;
};

function requestedText(args: unknown): string {
  const request: unknown = Reflect.get(args ?? {}, 'request');
  return String(Reflect.get(request ?? {}, 'text'));
}

function translationAnswer(rust: FakeRust, text: string) {
  return Effect.gen(function* () {
    const gate = rust.translationGates.get(text);
    if (gate) yield* Deferred.await(gate);
    const failure = rust.failingTranslations.get(text);
    if (failure) return yield* failure;
    return { text, native_language: 'ru', translation: `Перевод: ${text}` };
  });
}

function explanationAnswer(rust: FakeRust, text: string) {
  return Effect.gen(function* () {
    const gate = rust.explanationGates.get(text);
    if (gate) yield* Deferred.await(gate);
    if (rust.failingExplanations > 0) {
      rust.failingExplanations -= 1;
      return yield* new IpcError({ code: 'unavailable', message: 'Apple is unavailable.' });
    }
    return { text, english_explanation: `Meaning of ${text}.` };
  });
}

function answer(rust: FakeRust, command: string, args: unknown) {
  switch (command) {
    case 'translate_text':
      return translationAnswer(rust, requestedText(args));
    case 'explain_text':
      return explanationAnswer(rust, requestedText(args));
    default:
      return Effect.fail(new IpcDecodeError({ command, cause: 'unexpected command' }));
  }
}

function makeFakeRust() {
  const rust: FakeRust = {
    calls: [],
    translationGates: new Map(),
    explanationGates: new Map(),
    failingTranslations: new Map(),
    failingExplanations: 0,
  };
  const layer = Layer.succeed(Ipc, {
    invoke: (command, args) => {
      rust.calls.push({ command, args });
      return answer(rust, command, args);
    },
  });
  const serviceLayer = TextTranslationService.layer.pipe(
    Layer.provide(layer),
    Layer.provideMerge(Reactivity.layer),
  );
  return { rust, layer: serviceLayer };
}

function makeSession() {
  const fake = makeFakeRust();
  const registry = AtomRegistry.make({ initialValues: [[runtime.layer, fake.layer]] });
  registry.mount(lookupCommandAtom);
  return { registry, rust: fake.rust };
}

function openGate(gates: Map<string, Gate>, text: string) {
  const gate = Effect.runSync(Deferred.make<void>());
  gates.set(text, gate);
  return () => Effect.runSync(Deferred.succeed(gate, undefined));
}

async function settle() {
  for (let turn = 0; turn < 8; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

function type(registry: AtomRegistry.AtomRegistry, text: string) {
  openPanel(registry);
  changeDraft(registry, text);
  submitDraft(registry);
}

function commands(rust: FakeRust) {
  return rust.calls.map((call) => call.command);
}

it('shows the translation as soon as it arrives and the explanation after it', async () => {
  const { registry, rust } = makeSession();
  const releaseExplanation = openGate(rust.explanationGates, 'take it for granted');

  type(registry, 'take it for granted');
  await settle();

  const lookup = registry.get(lookupAtom);
  expect(lookup.tag === 'translated' && lookup.translation.translation).toBe(
    'Перевод: take it for granted',
  );
  expect(lookup.tag === 'translated' && lookup.explanation.tag).toBe('pending');

  releaseExplanation();
  await settle();
  const explained = registry.get(lookupAtom);
  expect(explained.tag === 'translated' && explained.explanation).toEqual({
    tag: 'ready',
    text: 'Meaning of take it for granted.',
  });
});

it('translates a phrase and sends the normalised text', async () => {
  const { registry, rust } = makeSession();

  type(registry, '  “I have been working here.”  ');
  await settle();

  expect(rust.calls[0]).toEqual({
    command: 'translate_text',
    args: { request: { text: 'I have been working here', context: '' } },
  });
  expect(registry.get(draftAtom)).toBe('I have been working here');
});

it('sends the sentence around a selection as context', async () => {
  const { registry, rust } = makeSession();
  registry.set(selectionAtom, {
    text: 'projects',
    context: 'Which useful tool helps you plan your projects?',
    anchor: { left: 0, top: 0, placement: 'above' },
  });

  translateSelection(registry);
  await settle();

  expect(rust.calls[0]?.args).toEqual({
    request: { text: 'projects', context: 'Which useful tool helps you plan your projects?' },
  });
  expect(registry.get(panelOpenAtom)).toBe(true);
  expect(registry.get(selectionAtom)).toBeUndefined();
});

it('never lets a slow older translation replace a newer selection', async () => {
  const { registry, rust } = makeSession();
  const releaseOlder = openGate(rust.translationGates, 'older phrase');

  type(registry, 'older phrase');
  await settle();
  expect(registry.get(lookupAtom).tag).toBe('translating');

  changeDraft(registry, 'newer phrase');
  submitDraft(registry);
  await settle();
  releaseOlder();
  await settle();

  const lookup = registry.get(lookupAtom);
  expect(lookup.tag === 'translated' && lookup.translation.text).toBe('newer phrase');
});

it('never shows a late explanation for a previous selection', async () => {
  const { registry, rust } = makeSession();
  const releaseOlder = openGate(rust.explanationGates, 'older phrase');

  type(registry, 'older phrase');
  await settle();
  changeDraft(registry, 'newer phrase');
  submitDraft(registry);
  await settle();
  releaseOlder();
  await settle();

  const lookup = registry.get(lookupAtom);
  expect(lookup.tag === 'translated' && lookup.translation.text).toBe('newer phrase');
  expect(lookup.tag === 'translated' && lookup.explanation).toEqual({
    tag: 'ready',
    text: 'Meaning of newer phrase.',
  });
});

it('drops a pending lookup when the panel is closed', async () => {
  const { registry, rust } = makeSession();
  const release = openGate(rust.translationGates, 'useful');

  type(registry, 'useful');
  await settle();
  closePanel(registry);
  release();
  await settle();

  expect(registry.get(lookupAtom)).toEqual({ tag: 'idle' });
  expect(registry.get(panelOpenAtom)).toBe(false);
  expect(commands(rust)).toEqual(['translate_text']);
});

it('keeps the translation when the explanation fails and retries only the explanation', async () => {
  const { registry, rust } = makeSession();
  rust.failingExplanations = 1;

  type(registry, 'useful');
  await settle();
  const failed = registry.get(lookupAtom);
  expect(failed.tag === 'translated' && failed.translation.translation).toBe('Перевод: useful');
  expect(failed.tag === 'translated' && failed.explanation.tag).toBe('failed');

  retryExplanation(registry);
  await settle();

  const retried = registry.get(lookupAtom);
  expect(retried.tag === 'translated' && retried.explanation).toEqual({
    tag: 'ready',
    text: 'Meaning of useful.',
  });
  expect(commands(rust)).toEqual(['translate_text', 'explain_text', 'explain_text']);
});

it('keeps the recovery copy of a failed translation and skips the explanation', async () => {
  const { registry, rust } = makeSession();
  rust.failingTranslations.set(
    'useful',
    new IpcError({ code: 'process_failed', message: 'Translation could not finish. Retry.' }),
  );

  type(registry, 'useful');
  await settle();

  const lookup = registry.get(lookupAtom);
  expect(lookup.tag === 'failed' && lookup.failure).toMatchObject({
    code: 'process_failed',
    message: 'Translation could not finish. Retry.',
  });
  expect(commands(rust)).toEqual(['translate_text']);

  rust.failingTranslations.clear();
  submitDraft(registry);
  await settle();
  expect(registry.get(lookupAtom).tag).toBe('translated');
});

it('rejects text over the phrase limit without calling Rust', async () => {
  const { registry, rust } = makeSession();

  type(registry, 'one two three four five six seven eight nine');
  await settle();

  const lookup = registry.get(lookupAtom);
  expect(lookup.tag === 'failed' && lookup.failure).toMatchObject({ code: 'invalid_request' });
  expect(rust.calls).toEqual([]);
});

it('forgets an earlier result when the typed text changes', async () => {
  const { registry } = makeSession();

  type(registry, 'useful');
  await settle();
  expect(registry.get(lookupAtom).tag).toBe('translated');

  changeDraft(registry, 'usefu');
  expect(registry.get(lookupAtom)).toEqual({ tag: 'idle' });
});
