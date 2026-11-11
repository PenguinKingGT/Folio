/** Strict, environment-independent XML parsing shared by publication parsers. */
import { DOMParser } from '@xmldom/xmldom';
import type { Document, Element } from '@xmldom/xmldom';

/** Parse bounded XML; XHTML permits external doctype declarations without fetching DTDs. */
export function parseXml(source: string, mode: 'xml' | 'xhtml' = 'xml'): Document {
  if (source.length > 5 * 1024 * 1024) {
    throw new RangeError('XML exceeds the document size limit.');
  }
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source) || (mode === 'xml' && /<!DOCTYPE/i.test(source))) {
    throw new TypeError('DTD and entity declarations are not supported.');
  }
  try {
    const document = new DOMParser({
      onError: (_level, message) => {
        throw new TypeError(message);
      },
    }).parseFromString(source, mode === 'xml' ? 'application/xml' : 'application/xhtml+xml');
    if (document.documentElement === null) {
      throw new TypeError('XML document has no root element.');
    }
    return document;
  } catch (cause) {
    throw new TypeError('Invalid XML document.', { cause });
  }
}

/** Select direct children by expanded XML name, independent of namespace prefixes. */
export function children(element: Element, localName: string, namespace: string): Element[] {
  const result: Element[] = [];
  const matches = element.getElementsByTagNameNS(namespace, localName);
  for (let index = 0; index < matches.length; index += 1) {
    const child = matches.item(index);
    if (child !== null && child.parentNode === element) {
      result.push(child);
    }
  }
  return result;
}
