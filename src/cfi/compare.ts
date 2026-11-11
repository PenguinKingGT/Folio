/** CFI sorting follows structural positions, ignoring assertions as required by the specification. */
import type { CfiData, CfiPath } from './types';

/** Compare bounded numeric sequences, treating a prefix as preceding its descendants. */
function compareNumbers(left: readonly number[], right: readonly number[]): number {
  for (const [index, value] of left.entries()) {
    const other = right[index];
    if (other === undefined) {
      return 1;
    }
    if (value !== other) {
      return Math.sign(value - other);
    }
  }
  return left.length < right.length ? -1 : 0;
}

/** Compare structural document paths numerically rather than lexicographically. */
export function compareCfiPaths(left: readonly CfiPath[], right: readonly CfiPath[]): number {
  for (const [index, a] of left.entries()) {
    const b = right[index];
    if (b === undefined) {
      return 1;
    }
    const steps = compareNumbers(
      a.steps.map((step) => step.value),
      b.steps.map((step) => step.value),
    );
    if (steps !== 0) {
      return steps;
    }
    const offset = (a.offset ?? 0) - (b.offset ?? 0);
    if (offset !== 0) {
      return Math.sign(offset);
    }
  }
  return left.length < right.length ? -1 : 0;
}

/** Expand one range endpoint into an ordinary point while retaining document indirections. */
export function collapseCfi(data: CfiData, toStart: boolean): CfiData {
  if (data.range === null) {
    return data;
  }
  const common = data.paths[data.paths.length - 1];
  if (common === undefined) {
    throw new TypeError('CFI range has no common path.');
  }
  const endpoint = toStart ? data.range.start : data.range.end;
  return {
    paths: [
      ...data.paths.slice(0, -1),
      {
        steps: [...common.steps, ...endpoint.steps],
        offset: endpoint.offset,
        assertion: endpoint.assertion,
      },
    ],
    range: null,
  };
}
