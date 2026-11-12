/** Clip and merge native Range fragments without painting duplicate inline-element/text rectangles. */

/** Overlay coordinates use the reader surface's own untransformed CSS pixels. */
export interface AnnotationBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Reject empty/non-finite rectangles and clip valid fragments to the actual viewport. */
export function clipBox(box: AnnotationBox, width: number, height: number): AnnotationBox | null {
  if (![box.x, box.y, box.width, box.height, width, height].every(Number.isFinite)) {
    return null;
  }
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const right = Math.min(width, box.x + box.width);
  const bottom = Math.min(height, box.y + box.height);
  return right <= x || bottom <= y ? null : { x, y, width: right - x, height: bottom - y };
}

/** Inline elements often repeat the exact glyph geometry already represented by their text children. */
function contains(outer: AnnotationBox, inner: AnnotationBox): boolean {
  return (
    outer.x <= inner.x + 0.5 &&
    outer.y <= inner.y + 0.5 &&
    outer.x + outer.width >= inner.x + inner.width - 0.5 &&
    outer.y + outer.height >= inner.y + inner.height - 0.5
  );
}

/** Merge intersecting fragments in one row/column while preserving blank gaps between lines. */
function connected(first: AnnotationBox, second: AnnotationBox, vertical?: boolean): boolean {
  const row = Math.abs(first.y - second.y) <= 0.5 && Math.abs(first.height - second.height) <= 0.5;
  const column = Math.abs(first.x - second.x) <= 0.5 && Math.abs(first.width - second.width) <= 0.5;
  return (
    (vertical === undefined && (contains(first, second) || contains(second, first))) ||
    (vertical !== true &&
      row &&
      first.x <= second.x + second.width + 0.5 &&
      second.x <= first.x + first.width + 0.5) ||
    (vertical !== false &&
      column &&
      first.y <= second.y + second.height + 0.5 &&
      second.y <= first.y + first.height + 0.5)
  );
}

/** Return one bounding fragment for overlapping/touching glyph boxes. */
function union(first: AnnotationBox, second: AnnotationBox): AnnotationBox {
  const x = Math.min(first.x, second.x);
  const y = Math.min(first.y, second.y);
  return {
    x,
    y,
    width: Math.max(first.x + first.width, second.x + second.width) - x,
    height: Math.max(first.y + first.height, second.y + second.height) - y,
  };
}

/** Bound visible fragments; an explicit writing axis prevents merging distinct text rows or columns. */
export function mergeBoxes(
  boxes: readonly AnnotationBox[],
  vertical?: boolean,
): readonly AnnotationBox[] {
  if (boxes.length > 1024) {
    throw new RangeError('Too many visible annotation fragments.');
  }
  const result: AnnotationBox[] = [];
  for (const box of boxes) {
    let merged = box;
    for (let index = result.length - 1; index >= 0; index -= 1) {
      const previous = result[index];
      if (previous !== undefined && connected(previous, merged, vertical)) {
        merged = union(previous, merged);
        result.splice(index, 1);
      }
    }
    result.push(merged);
  }
  return result;
}
