export function isSelectingInside(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) {
    return false;
  }
  return element.contains(selection.anchorNode) && element.contains(selection.focusNode);
}
