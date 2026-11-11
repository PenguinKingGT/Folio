/** Encode headless page-break elements against the same passive tree used by native rendering. */
import type { Document, Element, Node } from '@xmldom/xmldom';
import { children } from '../xml/parse';
import { passiveElementRemoved } from '../content/policy';
import { escapeCfi } from '../cfi/syntax';
import { serializeCfiPath } from '../cfi/path';
import type { CfiStep } from '../cfi/types';

/** Narrow native XML element children without relying on browser globals. */
function element(node: Node): node is Element {
  return node.nodeType === 1;
}

/** Preserve ID assertions so a native parser can recover an authored element's identity. */
function step(node: Element, value: number): CfiStep {
  const id = node.getAttribute('id');
  return { value, assertion: id ? escapeCfi(id) : null };
}

/** Body uses canonical /4 because native standards-mode HTML always supplies a head first. */
export function elementCfi(document: Document, fragment: string, base: string): string {
  const root = document.documentElement;
  const body =
    root === null ? undefined : children(root, 'body', 'http://www.w3.org/1999/xhtml')[0];
  if (body === undefined) {
    throw new TypeError('Print-page indexing requires an XHTML body.');
  }
  const target = fragment === '' ? body : document.getElementById(fragment);
  if (target === null) {
    throw new RangeError(`Print-page anchor not found: ${fragment}`);
  }
  const steps: CfiStep[] = [];
  let current = target;
  while (current !== body) {
    if (steps.length >= 128) {
      throw new RangeError('Print-page CFI nesting exceeds the supported limit.');
    }
    const parent = current.parentNode;
    if (parent === null || !element(parent)) {
      throw new TypeError('Print-page anchors must be inside the XHTML body.');
    }
    const siblings = Array.from(parent.childNodes)
      .filter(element)
      .filter(
        (node) =>
          !passiveElementRemoved(node.localName || node.nodeName, node.getAttribute('http-equiv')),
      );
    const index = siblings.indexOf(current);
    if (index === -1) {
      throw new TypeError('Print-page anchor is inside removed passive content.');
    }
    steps.unshift(step(current, (index + 1) * 2));
    current = parent;
  }
  steps.unshift(step(body, 4));
  return `epubcfi(${base}!${serializeCfiPath({ steps, offset: null, assertion: null })})`;
}
