import type { SelectionAnchor, TextSelection } from '../../types';
import { boundedContext, normalizePhrase } from '../phrase';

export const TRANSLATION_UI_ATTRIBUTE = 'data-translation-ui';
const LOOKUP_ROOT_SELECTOR = '[data-word-lookup]';
const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const CONTEXT_RADIUS = 250;
const CONTEXT_WINDOW = 500;
const ANCHOR_MARGIN = 80;
const ROOM_ABOVE_NEEDED = 56;

function elementFor(node: Node): Element | null {
  return node instanceof Element ? node : node.parentElement;
}

function isInsideTranslationUi(element: Element | null): boolean {
  return element?.closest(`[${TRANSLATION_UI_ATTRIBUTE}]`) != null;
}

function isEditable(element: Element | null): boolean {
  return element?.closest(EDITABLE_SELECTOR) != null;
}

function anchorFor(bounds: DOMRect): SelectionAnchor {
  const hasRoomAbove = bounds.top >= ROOM_ABOVE_NEEDED;
  return {
    left: Math.max(
      ANCHOR_MARGIN,
      Math.min(window.innerWidth - ANCHOR_MARGIN, bounds.left + bounds.width / 2),
    ),
    top: hasRoomAbove ? bounds.top : bounds.bottom,
    placement: hasRoomAbove ? 'above' : 'below',
  };
}

function contextAround(range: Range, root: Element): string {
  const prefix = range.cloneRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  const content = root.textContent ?? '';
  const start = Math.max(
    0,
    Math.min(prefix.toString().length - CONTEXT_RADIUS, content.length - CONTEXT_WINDOW),
  );
  return boundedContext(content.slice(start, start + CONTEXT_WINDOW));
}

export function readTextSelection(): TextSelection | undefined {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return undefined;
  const range = selection.getRangeAt(0);
  const startElement = elementFor(range.startContainer);
  const endElement = elementFor(range.endContainer);
  if (isEditable(startElement) || isEditable(endElement)) return undefined;
  if (isInsideTranslationUi(startElement) || isInsideTranslationUi(endElement)) return undefined;
  const root = startElement?.closest(LOOKUP_ROOT_SELECTOR);
  if (!root || root !== endElement?.closest(LOOKUP_ROOT_SELECTOR)) return undefined;
  const text = normalizePhrase(selection.toString());
  if (!text) return undefined;
  return {
    text,
    context: contextAround(range, root),
    anchor: anchorFor(range.getBoundingClientRect()),
  };
}
