/** Shared pre-parser XML limits prevent entity expansion before either native or headless parsing. */

/** External XHTML doctypes are inert declarations; internal subsets and custom entities are never accepted. */
export function validateXmlSource(source: string, mode: 'xml' | 'xhtml'): void {
  if (typeof source !== 'string' || source.length > 5 * 1024 * 1024) {
    throw new RangeError('XML exceeds the document size limit.');
  }
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source) || (mode === 'xml' && /<!DOCTYPE/i.test(source))) {
    throw new TypeError('DTD and entity declarations are not supported.');
  }
}
