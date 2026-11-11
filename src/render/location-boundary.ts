/** Build immutable reading boundaries shared by fixed and reflowable layout reporting. */
import type { Book } from '../book/book';
import type { VisibleBoundary } from './location-types';

/** Freeze nested metadata so listeners cannot mutate another subscriber's snapshot. */
export function boundary(
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
