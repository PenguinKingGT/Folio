/** Convert chapter destinations and page turns into synchronous native scroll positions. */
import { rangeFromCfi } from '../cfi/dom';
import type { FlowState } from '../layout/flow';
import type { PaginationState } from '../layout/pagination';
import type { ResolvedTarget } from './target';

/** Read the current logical offset along the active axis. */
export function scrollOffset(document: Document, state: FlowState): number {
  const root = document.scrollingElement ?? document.documentElement;
  return state.axis === 'horizontal' ? root.scrollLeft : root.scrollTop;
}

/** Compute the final reachable viewport position, including incomplete spread padding. */
export function lastOffset(state: FlowState, pages: PaginationState | null): number {
  return pages === null
    ? Math.max(0, state.length - state.viewport)
    : (pages.pageCount - 1) * pages.advance;
}

/** Scroll immediately even when author CSS requests smooth scrolling. */
export function scrollToOffset(document: Document, state: FlowState, offset: number): void {
  document.defaultView?.scrollTo({
    left: state.axis === 'horizontal' ? offset : 0,
    top: state.axis === 'vertical' ? offset : 0,
    behavior: 'instant',
  });
}

/** Resolve a native rectangle; element CFIs and text carets both identify reading destinations. */
function targetRect(document: Document, target: ResolvedTarget): DOMRect | null {
  if (target.cfi !== null) {
    const range = rangeFromCfi(document, target.cfi);
    range.collapse(true);
    if (range.startContainer.nodeType === 1) {
      range.selectNode(range.startContainer);
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
    offset = scrollOffset(document, state) + (state.axis === 'horizontal' ? rect.left : rect.top);
    if (pages !== null) {
      offset = Math.floor((offset + 0.5) / pages.advance) * pages.advance;
    }
  }
  scrollToOffset(document, state, Math.max(0, Math.min(offset, lastOffset(state, pages))));
}
