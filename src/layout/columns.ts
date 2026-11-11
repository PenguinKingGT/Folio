/** Apply column geometry and measure real overflow, including an incomplete final spread. */
import type { PaginationGeometry, PaginationState } from './pagination';

/** Lay out a passive chapter as fixed-height horizontal CSS columns. */
export function applyColumns(document: Document, geometry: PaginationGeometry): PaginationState {
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
  // CSSOM rounds scrollWidth to integer pixels; tolerate one pixel to avoid a phantom column.
  const columns = Math.max(
    geometry.columnsPerView,
    Math.ceil((body.scrollWidth + geometry.gap - 1) / (geometry.columnWidth + geometry.gap)),
  );
  const pageCount = Math.ceil(columns / geometry.columnsPerView);
  // Padding preserves the last view's scroll target even when only its first column contains text.
  const totalWidth = pageCount * geometry.advance - geometry.gap;
  root.style.paddingRight = `${Math.max(0, totalWidth - geometry.width)}px`;
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
