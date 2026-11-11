/** Public native DOM / CFI conversion with transparent annotation-wrapper support. */
import { Cfi } from './cfi';
import { serializeCfiPath } from './path';
import { normalizeBoundary } from './dom/boundary';
import { encodeNode } from './dom/encode';
import { resolvePoint } from './dom/resolve';
import type { CfiPath } from './types';

/** A package CFI path identifies the chapter; ignoreClass names a single transparent wrapper class. */
export interface CfiDomOptions {
  base: string;
  ignoreClass?: string;
}

/** Validate a wrapper class token before DOMTokenList access. */
function validateClass(value?: string): void {
  if (value !== undefined && (value === '' || /\s/.test(value))) {
    throw new TypeError('ignoreClass must be a single non-empty class token.');
  }
}

/** Create a point CFI from a non-root element or text node at offset zero. */
export function cfiFromNode(node: Node, options: CfiDomOptions): Cfi {
  validateClass(options.ignoreClass);
  return new Cfi(
    `epubcfi(${options.base}!${serializeCfiPath(encodeNode(node, 0, options.ignoreClass))})`,
  );
}

/** Encode a native text Range; element boundaries normalize to equivalent descendant text. */
export function cfiFromRange(range: Range, options: CfiDomOptions): Cfi {
  validateClass(options.ignoreClass);
  if (!range.collapsed && range.toString() === '') {
    throw new TypeError('Textless element ranges are not supported; use a node CFI.');
  }
  const start = normalizeBoundary(range.startContainer, range.startOffset, false);
  const end = range.collapsed
    ? start
    : normalizeBoundary(range.endContainer, range.endOffset, true);
  const first = encodeNode(start.node, start.offset, options.ignoreClass);
  const last = encodeNode(end.node, end.offset, options.ignoreClass);
  if (range.collapsed) {
    return new Cfi(`epubcfi(${options.base}!${serializeCfiPath(first)})`);
  }
  let shared = 0;
  while (shared < first.steps.length && first.steps[shared]?.value === last.steps[shared]?.value) {
    shared += 1;
  }
  const common: CfiPath = { steps: first.steps.slice(0, shared), offset: null, assertion: null };
  const prefix = serializeCfiPath(common);
  if (prefix === '') {
    throw new TypeError('Range endpoints must share a content ancestor.');
  }
  const a = serializeCfiPath({ ...first, steps: first.steps.slice(shared) });
  const b = serializeCfiPath({ ...last, steps: last.steps.slice(shared) });
  return new Cfi(`epubcfi(${options.base}!${prefix},${a},${b})`);
}

/** Resolve a point/range CFI in its matching native document; nested document indirections reject. */
export function rangeFromCfi(document: Document, input: Cfi | string, ignoreClass?: string): Range {
  validateClass(ignoreClass);
  const cfi = typeof input === 'string' ? new Cfi(input) : input;
  if (cfi.data.paths.length !== 2) {
    throw new TypeError('DOM resolution requires one package-to-content indirection.');
  }
  const first = cfi.collapse().data.paths[1];
  const last = cfi.collapse(false).data.paths[1];
  if (first === undefined || last === undefined) {
    throw new TypeError('CFI is missing content endpoints.');
  }
  const start = resolvePoint(document, first, ignoreClass);
  const end = resolvePoint(document, last, ignoreClass);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  const endpoint = document.createRange();
  endpoint.setStart(end.node, end.offset);
  // START_TO_START is zero; numeric use also works with documents from another browser realm.
  if (range.compareBoundaryPoints(0, endpoint) > 0) {
    throw new TypeError('Resolved CFI endpoints are reversed after assertion recovery.');
  }
  range.setEnd(end.node, end.offset);
  return range;
}

/** Resolve the starting node of a point or range CFI in its matching document. */
export function nodeFromCfi(document: Document, input: Cfi | string, ignoreClass?: string): Node {
  return rangeFromCfi(document, input, ignoreClass).startContainer;
}
