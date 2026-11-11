/** Capture native chapter selections without inserting CFI-visible wrapper elements. */
import { cfiFromRange } from '../cfi/dom';
import { escapeCfi } from '../cfi/syntax';
import type { Section } from '../spine/section';
import type { ContentSelection } from './types';

/** Ignore collapsed, head-only, and textless selections while retaining exact Unicode Range boundaries. */
export function contentSelection(
  document: Document,
  section: Section,
  spineStep: number,
): ContentSelection | null {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0).cloneRange();
  if (!document.body.contains(range.commonAncestorContainer) || range.toString() === '') {
    return null;
  }
  const base = `/${spineStep}/${(section.index + 1) * 2}[${escapeCfi(section.idref)}]`;
  return Object.freeze({
    section,
    range,
    cfi: cfiFromRange(range, { base }).toString(),
    text: range.toString(),
  });
}
