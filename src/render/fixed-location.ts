/** Map fixed page/spread boundaries using each document's unscaled native viewport. */
import type { Book } from '../book/book';
import type { RenderedPage } from './fixed-spread';
import type { VisibleLocation } from './location-types';
import { escapeCfi } from '../cfi/syntax';
import { visibleCfis } from './visible';
import { measureFrame } from '../layout/columns';
import { boundary } from './location-boundary';

/** A fixed spine item is exactly one authored page, including when paired with its neighbor. */
export function readFixedLocation(
  book: Book,
  pages: readonly RenderedPage[],
): VisibleLocation | null {
  const first = pages[0];
  const last = pages.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  /** Measure one page without mixing transformed host coordinates with native document rectangles. */
  function endpoints(page: RenderedPage) {
    const base = `/${book.publication.spineStep}/${(page.section.index + 1) * 2}[${escapeCfi(page.section.idref)}]`;
    return measureFrame(page.frame, () =>
      visibleCfis(page.document, base, page.frame.clientWidth, page.frame.clientHeight),
    );
  }
  return Object.freeze({
    start: boundary(book, first.section, endpoints(first).start, 1, 1),
    end: boundary(book, last.section, endpoints(last).end, 1, 1),
    atStart: book.spine.adjacent(first.section.index, 'previous') === null,
    atEnd: book.spine.adjacent(last.section.index, 'next') === null,
  });
}
