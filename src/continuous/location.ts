/** Map a host scrollport's clipped native page rectangles to whole-book reading boundaries. */
import type { Book } from '../book/book';
import type { VisibleLocation } from '../render/location-types';
import { boundary } from '../render/location-boundary';
import { visibleCfis } from '../render/visible';
import { escapeCfi } from '../cfi/syntax';
import type { ContinuousPort } from './port';
import type { ContinuousWindow } from './window';
import type { ContinuousPage } from './page';
import { isFixed } from '../layout/fixed-model';

/** Compare shared logical offsets so native rectangle rounding cannot create phantom preceding pages. */
export function visiblePages(
  port: ContinuousPort,
  window: ContinuousWindow,
): readonly ContinuousPage[] {
  const state = port.state(window.offsets.total);
  if (state === null) {
    return [];
  }
  const offset = port.offset();
  return window.all().filter((page) => {
    const start = window.offsets.start(page.section.index);
    return start + page.measured.extent > offset && start < offset + state.viewport;
  });
}

/** Derive CFIs in iframe coordinates, including the scale of authored fixed pages. */
function endpoints(book: Book, port: ContinuousPort, page: ContinuousPage) {
  const view = page.rendered();
  const viewport = port.viewport.getBoundingClientRect();
  const frame = view.frame.getBoundingClientRect();
  const scaleX = frame.width / view.frame.clientWidth;
  const scaleY = frame.height / view.frame.clientHeight;
  const base = `/${book.publication.spineStep}/${(page.section.index + 1) * 2}[${escapeCfi(page.section.idref)}]`;
  return visibleCfis(view.document, base, viewport.width / scaleX, viewport.height / scaleY, {
    x: (viewport.left - frame.left) / scaleX,
    y: (viewport.top - frame.top) / scaleY,
  });
}

/** Report actual visible chapters while keeping estimated scrollbar positions out of CFI metadata. */
export function continuousLocation(
  book: Book,
  port: ContinuousPort,
  window: ContinuousWindow,
): VisibleLocation | null {
  const pages = visiblePages(port, window);
  const first = pages[0];
  const last = pages.at(-1);
  const state = port.state(window.offsets.total);
  if (first === undefined || last === undefined || state === null) {
    return null;
  }
  const startLocal = Math.max(0, port.offset() - window.offsets.start(first.section.index));
  const endLocal = Math.max(
    1,
    port.offset() + state.viewport - window.offsets.start(last.section.index),
  );
  const firstTotal = isFixed(book.publication, first.section)
    ? 1
    : Math.max(1, Math.ceil(first.measured.extent / state.viewport));
  const lastTotal = isFixed(book.publication, last.section)
    ? 1
    : Math.max(1, Math.ceil(last.measured.extent / state.viewport));
  const sections = window.offsets.all();
  return Object.freeze({
    start: boundary(
      book,
      first.section,
      endpoints(book, port, first).start,
      Math.min(firstTotal, Math.floor(startLocal / state.viewport) + 1),
      firstTotal,
    ),
    end: boundary(
      book,
      last.section,
      endpoints(book, port, last).end,
      Math.min(lastTotal, Math.ceil(endLocal / state.viewport)),
      lastTotal,
    ),
    atStart: first.section === sections[0] && port.offset() <= 1,
    atEnd:
      last.section === sections.at(-1) &&
      port.offset() >= Math.max(0, window.offsets.total - state.viewport) - 1,
  });
}
