/** Resolve CFI ranges and map native fragment geometry through fixed/host transforms into one reader overlay. */
import { selectedTextRects } from './text-rects';
import { rangeFromCfi } from '../cfi/dom';
import { Cfi } from '../cfi/cfi';
import { targetRect } from '../render/position';
import type { RenderedPage } from '../render/fixed-spread';
import type { Annotation } from './types';
import { clipBox, mergeBoxes } from './boxes';
import type { AnnotationBox } from './boxes';

/** One rendered registration can paint multiple clipped text fragments. */
export interface DrawnAnnotation {
  readonly annotation: Annotation;
  readonly boxes: readonly AnnotationBox[];
  readonly vertical: boolean;
}

/** Validate loaded content before publishing an add/update; unloaded targets are checked when rendered. */
export function annotationRange(document: Document, annotation: Annotation): Range {
  const range = rangeFromCfi(document, annotation.cfi);
  if (
    !document.body.contains(range.commonAncestorContainer) ||
    (annotation.type !== 'mark' && (range.collapsed || range.toString() === ''))
  ) {
    throw new TypeError('Annotation target does not identify reading text.');
  }
  return range;
}

/** Convert a chapter-viewport rectangle to the host surface's local coordinate system. */
function project(rect: DOMRect, page: RenderedPage, surface: HTMLElement): AnnotationBox {
  const frame = page.frame.getBoundingClientRect();
  const bounds = surface.getBoundingClientRect();
  const scaleX = bounds.width / surface.clientWidth;
  const scaleY = bounds.height / surface.clientHeight;
  const frameX = frame.width / page.frame.clientWidth;
  const frameY = frame.height / page.frame.clientHeight;
  return {
    x: (frame.left + rect.left * frameX - bounds.left) / scaleX,
    y: (frame.top + rect.top * frameY - bounds.top) / scaleY,
    width: (rect.width * frameX) / scaleX,
    height: (rect.height * frameY) / scaleY,
  };
}

/** Mark badges stay attached to a visible target rather than pinning offscreen annotations to viewport edges. */
function markBox(
  box: AnnotationBox,
  annotation: Annotation,
  width: number,
  height: number,
): readonly AnnotationBox[] {
  if (clipBox(box, width, height) === null) {
    return [];
  }
  const size = annotation.style.size;
  return [
    {
      x: Math.max(0, Math.min(width - size, box.x + box.width - size / 2)),
      y: Math.max(0, Math.min(height - size, box.y - size / 2)),
      width: Math.min(size, width),
      height: Math.min(size, height),
    },
  ];
}

/** Native Range fragments already include chapter scrolling; iframe bounds supply fixed-layout/host scaling. */
export function annotationGeometry(
  page: RenderedPage,
  annotation: Annotation,
  surface: HTMLElement,
): DrawnAnnotation {
  const range = annotationRange(page.document, annotation);
  const vertical =
    page.document.defaultView
      ?.getComputedStyle(page.document.body)
      .writingMode.startsWith('vertical') === true;
  const { clientWidth: width, clientHeight: height } = surface;
  if (annotation.type === 'mark') {
    const rect = targetRect(page.document, {
      section: page.section,
      cfi: new Cfi(annotation.cfi).collapse(),
      fragment: null,
    });
    return {
      annotation,
      vertical,
      boxes: rect === null ? [] : markBox(project(rect, page, surface), annotation, width, height),
    };
  }
  const rects = selectedTextRects(range);
  const boxes = Array.from(rects).flatMap((rect) => {
    const box = clipBox(project(rect, page, surface), width, height);
    return box === null ? [] : [box];
  });
  return { annotation, vertical, boxes: mergeBoxes(boxes, vertical) };
}
