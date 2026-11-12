/** Map real viewport intersections to structural CFIs without walking every character. */
import { cfiFromNode, cfiFromRange } from '../cfi/dom';
import { Cfi } from '../cfi/cfi';
import { scalarBoundary } from '../text/scalars';

/** Native document coordinates of the visible subrectangle inside an expanded iframe. */
interface ClipRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A rectangle must occupy painted space within both viewport dimensions. */
function intersects(rect: DOMRect, clip: ClipRect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > clip.left &&
    rect.bottom > clip.top &&
    rect.left < clip.right &&
    rect.top < clip.bottom
  );
}

/** Test a text slice against the viewport, retaining individual line/column rectangles. */
function visibleSlice(
  range: Range,
  node: Node,
  start: number,
  end: number,
  clip: ClipRect,
): boolean {
  range.setStart(node, start);
  range.setEnd(node, end);
  return Array.from(range.getClientRects()).some((rect) => intersects(rect, clip));
}

/** Locate the first prefix or last suffix intersecting the viewport in logarithmic probes. */
function boundary(range: Range, node: Node, length: number, clip: ClipRect, end: boolean): number {
  let low = 0;
  let high = length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const visible = end
      ? visibleSlice(range, node, mid, length, clip)
      : visibleSlice(range, node, 0, mid + 1, clip);
    if (visible === end) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/** Encode one text endpoint without retaining its native Range. */
function textCfi(document: Document, node: Node, offset: number, base: string): string {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  return cfiFromRange(range, { base }).toString();
}

/** Find first/last visible text, falling back to a visible media element or the body. */
export function visibleCfis(
  document: Document,
  base: string,
  width: number,
  height: number,
  origin: { x: number; y: number } = { x: 0, y: 0 },
): { start: string; end: string } {
  const clip: ClipRect = {
    left: origin.x,
    top: origin.y,
    right: origin.x + width,
    bottom: origin.y + height,
  };
  const walker = document.createTreeWalker(document.body, 4);
  const range = document.createRange();
  let start: string | null = null;
  let end: string | null = null;
  let node = walker.nextNode();
  while (node !== null) {
    const text = node.nodeValue ?? '';
    const visible =
      document.defaultView?.getComputedStyle(node.parentElement ?? document.body).visibility ===
      'visible';
    if (text.length > 0 && visible && visibleSlice(range, node, 0, text.length, clip)) {
      if (start === null) {
        const offset = boundary(range, node, text.length, clip, false);
        start = textCfi(document, node, scalarBoundary(text, offset, false), base);
      }
      const offset = boundary(range, node, text.length, clip, true);
      end = textCfi(document, node, scalarBoundary(text, offset, true), base);
    }
    node = walker.nextNode();
  }
  return includeMedia(document, base, clip, start, end);
}

/** Include visible atomic content in DOM reading order, with a body fallback for empty viewports. */
function includeMedia(
  document: Document,
  base: string,
  clip: ClipRect,
  start: string | null,
  end: string | null,
): { start: string; end: string } {
  let first = start;
  let last = end;
  const elements = Array.from(document.body.querySelectorAll('img,svg,video,canvas')).filter(
    (item) =>
      intersects(item.getBoundingClientRect(), clip) &&
      document.defaultView?.getComputedStyle(item).visibility === 'visible',
  );
  for (const element of elements) {
    const cfi = cfiFromNode(element, { base });
    if (first === null || cfi.compare(new Cfi(first)) < 0) {
      first = cfi.toString();
    }
    if (last === null || cfi.compare(new Cfi(last)) > 0) {
      last = cfi.toString();
    }
  }
  const fallback = first ?? cfiFromNode(document.body, { base }).toString();
  return { start: fallback, end: last ?? fallback };
}
