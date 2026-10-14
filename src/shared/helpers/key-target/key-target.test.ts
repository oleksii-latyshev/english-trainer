import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { keyTarget } from './index';

type FakeElement = {
  tagName: string;
  isContentEditable?: boolean;
  type?: string;
  role?: string;
};

class FakeHtmlElement {
  readonly tagName: string;
  readonly isContentEditable: boolean;
  readonly type: string;
  private readonly role: string | null;

  constructor(fields: FakeElement) {
    this.tagName = fields.tagName;
    this.isContentEditable = fields.isContentEditable ?? false;
    this.type = fields.type ?? '';
    this.role = fields.role ?? null;
  }

  getAttribute(name: string): string | null {
    return name === 'role' ? this.role : null;
  }
}

class FakeInput extends FakeHtmlElement {}

const globals = globalThis as unknown as Record<string, unknown>;
let saved: { element: unknown; input: unknown };

beforeEach(() => {
  saved = { element: globals.HTMLElement, input: globals.HTMLInputElement };
  globals.HTMLElement = FakeHtmlElement;
  globals.HTMLInputElement = FakeInput;
});

afterEach(() => {
  globals.HTMLElement = saved.element;
  globals.HTMLInputElement = saved.input;
});

function element(fields: FakeElement): EventTarget {
  return new FakeHtmlElement(fields) as unknown as EventTarget;
}

describe('key target', () => {
  it('lets a page without focus keep every key', () => {
    expect(keyTarget(null)).toBe('other');
    expect(keyTarget(element({ tagName: 'DIV' }))).toBe('other');
  });

  it('keeps typing keys for text fields', () => {
    expect(keyTarget(element({ tagName: 'TEXTAREA' }))).toBe('text');
    expect(keyTarget(element({ tagName: 'DIV', isContentEditable: true }))).toBe('text');
    expect(
      keyTarget(new FakeInput({ tagName: 'INPUT', type: 'text' }) as unknown as EventTarget),
    ).toBe('text');
  });

  it('keeps Space for buttons, links and button-like roles', () => {
    expect(keyTarget(element({ tagName: 'BUTTON' }))).toBe('control');
    expect(keyTarget(element({ tagName: 'A' }))).toBe('control');
    expect(keyTarget(element({ tagName: 'DIV', role: 'switch' }))).toBe('control');
    expect(
      keyTarget(new FakeInput({ tagName: 'INPUT', type: 'checkbox' }) as unknown as EventTarget),
    ).toBe('control');
  });
});
