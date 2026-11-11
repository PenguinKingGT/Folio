/** Apply native chapter scrolling, resetting pagination-only CSS when changing modes. */
import { applyColumns } from './columns';
import { computePagination } from './pagination';
import type { WritingState } from './writing';

/** Configure vertical document flow or horizontal, non-snapping column scrolling. */
export function applyScrolling(
  document: Document,
  width: number,
  height: number,
  writing: WritingState,
): { length: number; viewport: number } {
  const root = document.documentElement;
  const body = document.body;
  const { axis, reverse, writingMode } = writing;
  const inline = writingMode === 'horizontal-tb' ? 'horizontal' : 'vertical';
  if (axis === inline) {
    applyColumns(
      document,
      computePagination(width, height, { spread: 'none', gap: 0 }, axis),
      reverse,
    );
    // Hide the scrollbar so it cannot cover the final line of a fixed-size column.
    root.style.scrollbarWidth = 'none';
  } else {
    naturalFlow(document, axis === 'vertical');
  }
  root.style.overflowX = axis === 'horizontal' ? 'auto' : 'hidden';
  root.style.overflowY = axis === 'vertical' ? 'auto' : 'hidden';
  root.scrollLeft = 0;
  root.scrollTop = 0;
  const viewport = axis === 'horizontal' ? width : height;
  const length =
    axis === 'horizontal'
      ? Math.max(root.scrollWidth, body.scrollWidth)
      : Math.max(root.scrollHeight, body.scrollHeight);
  return { length: Math.max(viewport, length), viewport };
}

/** Let blocks grow along their natural axis, including leftward vertical-rl content. */
function naturalFlow(document: Document, vertical: boolean): void {
  const root = document.documentElement;
  const body = document.body;
  for (const element of [root, body]) {
    element.style.width = vertical ? '100%' : 'auto';
    element.style.height = vertical ? 'auto' : '100%';
    element.style.margin = '0';
    element.style.padding = '0';
    element.style.boxSizing = 'border-box';
  }
  root.style.scrollbarWidth = vertical ? '' : 'none';
  body.style.columnWidth = 'auto';
  body.style.columnCount = 'auto';
  body.style.columnGap = 'normal';
  body.style.columnFill = 'balance';
}
