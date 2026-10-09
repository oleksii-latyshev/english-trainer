import { boundedTranslationContext, normalizeEnglishWord } from '@/lib/translationTypes';

export type WordSelection = {
  word: string;
  context: string;
  point: { left: number; top: number };
};

function elementFor(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement;
}

function isEditable(element: Element | null): boolean {
  return Boolean(
    element?.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    ),
  );
}

export function readWordSelection(): WordSelection | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return undefined;
  const range = selection.getRangeAt(0);
  const startElement = elementFor(range.startContainer);
  const endElement = elementFor(range.endContainer);
  if (isEditable(startElement) || isEditable(endElement)) return undefined;
  if (
    startElement?.closest('[data-word-translation-ui]') ||
    endElement?.closest('[data-word-translation-ui]')
  ) {
    return undefined;
  }
  const root = startElement?.closest('[data-word-lookup]');
  if (!root || root !== endElement?.closest('[data-word-lookup]')) return undefined;
  const word = normalizeEnglishWord(selection.toString());
  if (!word) return undefined;

  const prefix = range.cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  const content = root.textContent ?? '';
  const start = Math.max(0, Math.min(prefix.toString().length - 250, content.length - 500));
  const context = boundedTranslationContext(content.slice(start, start + 500));
  const bounds = range.getBoundingClientRect();
  return {
    word,
    context,
    point: {
      left: Math.max(80, Math.min(window.innerWidth - 80, bounds.left + bounds.width / 2)),
      top: Math.max(44, bounds.top),
    },
  };
}
