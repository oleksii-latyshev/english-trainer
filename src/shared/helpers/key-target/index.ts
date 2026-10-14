export type KeyTarget = 'text' | 'control' | 'other';

const CONTROL_ROLES = [
  'button',
  'switch',
  'checkbox',
  'radio',
  'tab',
  'menuitem',
  'option',
  'link',
];
const CONTROL_TAGS = ['BUTTON', 'A', 'SUMMARY'];
const TEXT_TAGS = ['TEXTAREA', 'SELECT'];
const BUTTON_LIKE_INPUTS = ['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file'];

function isTextField(target: HTMLElement): boolean {
  return target.isContentEditable || TEXT_TAGS.includes(target.tagName);
}

function isControl(target: HTMLElement): boolean {
  const role = target.getAttribute('role');
  return CONTROL_TAGS.includes(target.tagName) || (role !== null && CONTROL_ROLES.includes(role));
}

export function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof HTMLElement)) return 'other';
  if (isTextField(target)) return 'text';
  if (target instanceof HTMLInputElement) {
    return BUTTON_LIKE_INPUTS.includes(target.type) ? 'control' : 'text';
  }
  return isControl(target) ? 'control' : 'other';
}
