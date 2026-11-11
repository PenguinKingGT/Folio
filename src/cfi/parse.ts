/** Compose point and range parsing while preserving document indirections. */
import { collapseCfi, compareCfiPaths } from './compare';
import { parseCfiPath, serializeCfiPath } from './path';
import { splitCfi } from './syntax';
import type { CfiData } from './types';

/** Parse text CFIs; temporal and spatial termini explicitly reject rather than being truncated. */
export function parseCfi(source: string): CfiData {
  const value = source.startsWith('#') ? source.slice(1) : source;
  if (!value.startsWith('epubcfi(') || !value.endsWith(')') || value.length > 16_384) {
    throw new TypeError('Invalid EPUB CFI wrapper or length.');
  }
  const parts = splitCfi(value.slice(8, -1), ',');
  const parent = parts[0] ?? '';
  if (parts.length !== 1 && parts.length !== 3) {
    throw new TypeError('CFI requires a point or two range endpoints.');
  }
  const paths = splitCfi(parent, '!').map((path) => parseCfiPath(path));
  if (paths.slice(0, -1).some((path) => path.offset !== null)) {
    throw new TypeError('CFI indirection cannot follow a character offset.');
  }
  const start = parts[1];
  const end = parts[2];
  if (start === undefined || end === undefined) {
    return { paths, range: null };
  }
  if (paths[paths.length - 1]?.offset !== null) {
    throw new TypeError('A range common path cannot have an offset.');
  }
  const data: CfiData = {
    paths,
    range: { start: parseCfiPath(start, true), end: parseCfiPath(end, true) },
  };
  // Validate the expanded endpoints too: a shared text step cannot gain structural children.
  for (const point of [collapseCfi(data, true), collapseCfi(data, false)]) {
    point.paths.forEach((path) => parseCfiPath(serializeCfiPath(path)));
  }
  if (compareCfiPaths(collapseCfi(data, true).paths, collapseCfi(data, false).paths) > 0) {
    throw new TypeError('CFI range endpoints must be in document order.');
  }
  return data;
}

/** Serialize point/range data into its canonical epubcfi wrapper. */
export function serializeCfi(data: CfiData): string {
  let value = data.paths.map(serializeCfiPath).join('!');
  if (data.range !== null) {
    value += `,${serializeCfiPath(data.range.start)},${serializeCfiPath(data.range.end)}`;
  }
  return `epubcfi(${value})`;
}
