/** Shared pre-parser XML limits prevent entity expansion before either native or headless parsing. */

import { normalizeEmptyDoctype } from './empty-doctype';

/** Return bounded markup with inert bare XHTML empty subsets normalized; other internal subsets/entities remain rejected. */
export function validateXmlSource(source: string, mode: 'xml' | 'xhtml'): string {
  if (typeof source !== 'string' || source.length > 5 * 1024 * 1024) {
    throw new RangeError('XML exceeds the document size limit.');
  }
  const input = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const normalized = mode === 'xhtml' ? normalizeEmptyDoctype(input) : input;
  if (
    /<!ENTITY|<!DOCTYPE[^>]*\[/i.test(normalized) ||
    (mode === 'xml' && /<!DOCTYPE/i.test(normalized))
  ) {
    throw new TypeError('DTD and entity declarations are not supported.');
  }
  return normalized;
}
