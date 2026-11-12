/** Apply fixed-page fitting or reflow geometry through the existing bounded-view boundary. */
import type { PageViews } from '../render/page-views';
import type { ReaderLayout } from './reader-layout';
import type { PaginationOptions, PaginationState } from './pagination';

/** Fixed layout takes precedence over reflow; callers retain and restore their reading anchor separately. */
export function layoutPages(
  layout: ReaderLayout,
  view: PageViews,
  document: Document,
  options: PaginationOptions = {},
): PaginationState | null {
  layout.configure(options);
  const fixed = view.applyFixed(options);
  if (fixed !== null) {
    layout.useFixed(fixed.width, fixed.height, document);
    return null;
  }
  return layout.apply(view.frame, document, options);
}
