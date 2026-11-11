/** Binary search over sorted reading positions and text runs. */

/** Find the first entry satisfying a monotonic predicate, or length if none matches. */
export function lowerBound<T>(entries: readonly T[], matches: (entry: T) => boolean): number {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const entry = entries[middle];
    if (entry === undefined) {
      throw new TypeError('Sparse reading indexes are not supported.');
    }
    if (matches(entry)) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low;
}
