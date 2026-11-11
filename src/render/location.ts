/** Combine native visible endpoints with chapter, page, and sampled-progress metadata. */
import type { Book } from '../book/book';
import { escapeCfi } from '../cfi/syntax';
import { measureFrame } from '../layout/columns';
import type { NavigationHost } from './turn';
import { lastOffset, scrollOffset } from './position';
import { visibleCfis } from './visible';
import type { VisibleBoundary, VisibleLocation } from './location-types';

/** Read an immutable snapshot without generating a full-book progress index as a side effect. */
export function readLocation(book: Book, host: NavigationHost): VisibleLocation | null {
  const document = host.getContents();
  const section = host.currentSection;
  const state = host.flowState;
  if (document === null || section === null || state === null) {
    return null;
  }
  return measureFrame(host.frame, (width, height) => {
    const base = `/${book.publication.spineStep}/${(section.index + 1) * 2}[${escapeCfi(section.idref)}]`;
    const endpoints = visibleCfis(document, base, width, height);
    const offset = scrollOffset(document, state);
    const total =
      host.pagination?.pageCount ?? Math.max(1, Math.ceil(state.length / state.viewport));
    const page =
      offset >= lastOffset(state, host.pagination) - 1
        ? total
        : Math.min(
            total,
            Math.floor((offset + 1) / (host.pagination?.advance ?? state.viewport)) + 1,
          );
    const start = boundary(book, section, endpoints.start, page, total);
    const end = boundary(book, section, endpoints.end, page, total);
    return Object.freeze({
      start,
      end,
      atStart: offset <= 1 && book.spine.adjacent(section.index, 'previous') === null,
      atEnd:
        offset >= lastOffset(state, host.pagination) - 1 &&
        book.spine.adjacent(section.index, 'next') === null,
    });
  });
}

/** Freeze nested metadata so listeners cannot mutate another subscriber's snapshot. */
function boundary(
  book: Book,
  section: { index: number; href: string },
  cfi: string,
  page: number,
  total: number,
): VisibleBoundary {
  return Object.freeze({
    cfi,
    index: section.index,
    href: section.href,
    displayed: Object.freeze({ page, total }),
    location: book.locations.locationFromCfi(cfi),
    percentage: book.locations.percentageFromCfi(cfi),
  });
}
