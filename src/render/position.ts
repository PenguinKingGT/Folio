/** Convert chapter destinations and page turns into synchronous native scroll positions. */
import { rangeFromCfi } from '../cfi/dom';
import type { FlowState } from '../layout/flow';
import type { PaginationState } from '../layout/pagination';
import type { ResolvedTarget } from './target';

/** Read the current logical offset along the active axis. */
export function scrollOffset(document: Document, state: FlowState): number {
  const root = document.scrollingElement ?? document.documentElement;
  const offset = state.axis === 'horizontal' ? root.scrollLeft : root.scrollTop;
  return Math.max(0, state.reverse ? -offset : offset);
}

/** Compute the final reachable viewport position, including incomplete spread padding. */
export function lastOffset(state: FlowState, pages: PaginationState | null): number {
  return pages === null
    ? Math.max(0, state.length - state.viewport)
    : (pages.pageCount - 1) * pages.advance;
}

/** Scroll immediately even when author CSS requests smooth scrolling. */
export function scrollToOffset(document: Document, state: FlowState, offset: number): void {
  const native = state.reverse ? -offset : offset;
  document.defaultView?.scrollTo({
    left: state.axis === 'horizontal' ? native : 0,
    top: state.axis === 'vertical' ? native : 0,
    behavior: 'instant',
  });
}

/** Resolve a native rectangle; element CFIs and text carets both identify reading destinations. */
export function targetRect(document: Document, target: ResolvedTarget): DOMRect | null {
  if (target.cfi !== null) {
    const range = rangeFromCfi(document, target.cfi);
    range.collapse(true);
    if (range.startContainer.nodeType === 1) {
      range.selectNode(range.startContainer);
    } else {
      const text = range.startContainer.nodeValue ?? '';
      if (range.startOffset < text.length) {
        // A collapsed caret at a wrap can point to the preceding column in Firefox.
        const length = (text.codePointAt(range.startOffset) ?? 0) > 0xffff ? 2 : 1;
        range.setEnd(range.startContainer, Math.min(text.length, range.startOffset + length));
      }
    }
    return (
      range.getClientRects()[0] ??
      range.startContainer.parentElement?.getBoundingClientRect() ??
      null
    );
  }
  if (!target.fragment) {
    return null;
  }
  const element =
    document.getElementById(target.fragment) ?? document.getElementsByName(target.fragment)[0];
  if (element === undefined || element === null) {
    throw new RangeError(`Reading anchor not found: ${target.fragment}`);
  }
  return element.getBoundingClientRect();
}

/** Seek within a laid-out document, snapping paginated destinations to their containing spread. */
export function seekTarget(
  document: Document,
  state: FlowState,
  pages: PaginationState | null,
  target: ResolvedTarget,
): void {
  const rect = targetRect(document, target);
  let offset = 0;
  if (rect !== null) {
    const start = state.axis === 'horizontal' ? rect.left : rect.top;
    const end = state.axis === 'horizontal' ? rect.right : rect.bottom;
    offset = scrollOffset(document, state) + (state.reverse ? state.viewport - end : start);
    if (pages !== null) {
      offset = Math.floor((offset + 0.5) / pages.advance) * pages.advance;
    }
  }
  scrollToOffset(document, state, Math.max(0, Math.min(offset, lastOffset(state, pages))));
}
