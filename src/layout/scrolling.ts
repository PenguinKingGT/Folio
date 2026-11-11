/** Apply native chapter scrolling, resetting pagination-only CSS when changing modes. */
import { applyColumns } from './columns';
import { computePagination } from './pagination';
import type { ReadingAxis } from './flow';

/** Configure vertical document flow or horizontal, non-snapping column scrolling. */
export function applyScrolling(
  document: Document,
  width: number,
  height: number,
  axis: ReadingAxis,
): { length: number; viewport: number } {
  const root = document.documentElement;
  const body = document.body;
  const geometry = computePagination(width, height, { spread: 'none', gap: 0 });
  if (axis === 'horizontal') {
    applyColumns(document, geometry);
    root.style.overflowX = 'auto';
    root.style.overflowY = 'hidden';
    // Hide only the horizontal scrollbar so it cannot cover the final line in a fixed-height column.
    root.style.scrollbarWidth = 'none';
  } else {
    root.style.width = '100%';
    root.style.height = 'auto';
    root.style.margin = '0';
    root.style.padding = '0';
    root.style.boxSizing = 'border-box';
    root.style.overflowX = 'hidden';
    root.style.overflowY = 'auto';
    root.style.scrollbarWidth = '';
    body.style.width = '100%';
    body.style.height = 'auto';
    body.style.margin = '0';
    body.style.padding = '0';
    body.style.columnWidth = 'auto';
    body.style.columnCount = 'auto';
    body.style.columnGap = 'normal';
    body.style.columnFill = 'balance';
  }
  root.scrollLeft = 0;
  root.scrollTop = 0;
  const viewport = axis === 'horizontal' ? width : height;
  const length = axis === 'horizontal' ? root.scrollWidth : root.scrollHeight;
  return { length: Math.max(viewport, length), viewport };
}
