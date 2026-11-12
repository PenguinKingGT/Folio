/** Apply column geometry and measure real overflow, including an incomplete final spread. */
import type { PaginationGeometry, PaginationState } from './pagination';
import type { ReadingAxis } from './flow';
import type { ColumnMedia } from './column-media';

/** Supplement CSSOM dimensions when negative vertical overflow is omitted from scrollHeight. */
function columnExtent(document: Document, axis: ReadingAxis, reverse: boolean): number {
  const body = document.body;
  let extent = axis === 'horizontal' ? body.scrollWidth : body.scrollHeight;
  if (!reverse) {
    return extent;
  }
  const range = document.createRange();
  range.selectNodeContents(body);
  const bounds = body.getBoundingClientRect();
  const start = axis === 'horizontal' ? bounds.right : bounds.bottom;
  for (const rect of Array.from(range.getClientRects())) {
    const end = axis === 'horizontal' ? rect.left : rect.top;
    extent = Math.max(extent, start - end);
  }
  return extent;
}

/** Lay out a passive chapter as fixed-size CSS columns along the writing mode's inline axis. */
export function applyColumns(
  document: Document,
  geometry: PaginationGeometry,
  media: ColumnMedia,
  reverse = false,
): PaginationState {
  const root = document.documentElement;
  const body = document.body;
  root.style.width = `${geometry.width}px`;
  root.style.height = `${geometry.height}px`;
  root.style.margin = '0';
  root.style.padding = '0';
  root.style.boxSizing = 'content-box';
  root.style.overflow = 'hidden';
  body.style.width = `${geometry.width}px`;
  body.style.height = `${geometry.height}px`;
  body.style.margin = '0';
  body.style.padding = '0';
  body.style.boxSizing = 'border-box';
  body.style.columnWidth = `${geometry.columnWidth}px`;
  body.style.columnGap = `${geometry.gap}px`;
  body.style.columnCount = String(geometry.columnsPerView);
  body.style.columnFill = 'auto';
  media.apply(document, geometry);
  // CSSOM rounds scrollWidth to integer pixels; tolerate one pixel to avoid a phantom column.
  const columns = Math.max(
    geometry.columnsPerView,
    Math.ceil(
      (columnExtent(document, geometry.axis, reverse) + geometry.gap - 1) /
        (geometry.columnWidth + geometry.gap),
    ),
  );
  const pageCount = Math.ceil(columns / geometry.columnsPerView);
  // Padding preserves the last view's scroll target even when only its first column contains text.
  const total = pageCount * geometry.advance - geometry.gap;
  const viewport = geometry.axis === 'horizontal' ? geometry.width : geometry.height;
  let end: 'paddingLeft' | 'paddingRight' | 'paddingTop' | 'paddingBottom' = reverse
    ? 'paddingTop'
    : 'paddingBottom';
  if (geometry.axis === 'horizontal') {
    end = reverse ? 'paddingLeft' : 'paddingRight';
  }
  root.style[end] = `${Math.max(0, total - viewport)}px`;
  return Object.freeze({ ...geometry, columns, pageCount });
}

/** Measure hidden frames without painting a temporary visible chapter. */
export function measureFrame<T>(
  frame: HTMLElement,
  measure: (width: number, height: number) => T,
): T {
  const display = frame.style.display;
  const visibility = frame.style.visibility;
  frame.style.visibility = 'hidden';
  frame.style.display = 'block';
  try {
    const bounds = frame.getBoundingClientRect();
    return measure(bounds.width, bounds.height);
  } finally {
    frame.style.display = display;
    frame.style.visibility = visibility;
  }
}
