/** Preserve UTF-16 scalar boundaries in native positions and textual excerpts. */
/** Keep visible text endpoints outside UTF-16 surrogate pairs. */
export function scalarBoundary(text: string, offset: number, end: boolean): number {
  if (
    offset > 0 &&
    offset < text.length &&
    /[\uD800-\uDBFF]/.test(text.charAt(offset - 1)) &&
    /[\uDC00-\uDFFF]/.test(text.charAt(offset))
  ) {
    return offset + (end ? 1 : -1);
  }
  return offset;
}
