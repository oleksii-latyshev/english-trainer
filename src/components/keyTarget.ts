/** What has keyboard focus: typing keys belong to text fields, Space belongs to buttons and switches. */
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
const BUTTON_LIKE_INPUTS = ['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file'];

/** Typing fields keep every key; buttons, switches and links keep Space; the rest is free. */
export function keyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof HTMLElement)) return 'other';
  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return 'text';
  }
  if (target instanceof HTMLInputElement) {
    return BUTTON_LIKE_INPUTS.includes(target.type) ? 'control' : 'text';
  }
  const role = target.getAttribute('role');
  const isControl =
    ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName) ||
    (role !== null && CONTROL_ROLES.includes(role));
  return isControl ? 'control' : 'other';
}
