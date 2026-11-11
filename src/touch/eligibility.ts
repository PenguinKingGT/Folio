/** Keep selection, editable controls, links, and nested scroll regions in charge of their own gestures. */
import type { ReadingAxis } from '../layout/flow';

/** Use the target document's constructor because iframe elements belong to a different realm. */
export function touchEligible(
  document: Document,
  target: EventTarget | null,
  axis: ReadingAxis,
): boolean {
  if (document.getSelection()?.isCollapsed === false) {
    return false;
  }
  const realm = document.defaultView;
  let element = realm !== null && target instanceof realm.Element ? target : null;
  while (element !== null && element !== document.documentElement) {
    if (
      element.matches(
        'a,button,input,textarea,select,option,label,video,audio,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"]',
      )
    ) {
      return false;
    }
    const style = document.defaultView?.getComputedStyle(element);
    const overflow = axis === 'horizontal' ? style?.overflowX : style?.overflowY;
    const extent =
      axis === 'horizontal'
        ? element.scrollWidth - element.clientWidth
        : element.scrollHeight - element.clientHeight;
    if ((overflow === 'auto' || overflow === 'scroll') && extent > 1) {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}
