/** Preserve direct Dublin Core metadata values independently of convenience fields and OPF extensions. */
import type { Element } from '@xmldom/xmldom';
import { dcNamespace } from './helpers';

/** Group values in document order; repeated and empty values remain observable without namespace-prefix assumptions. */
export function readDublinCore(element: Element): Readonly<Record<string, readonly string[]>> {
  const values = new Map<string, string[]>();
  const children = element.getElementsByTagNameNS(dcNamespace, '*');
  for (let index = 0; index < children.length; index++) {
    const child = children.item(index);
    if (child?.parentNode === element && child.localName !== null) {
      const entries = values.get(child.localName) ?? [];
      entries.push((child.textContent || '').trim());
      values.set(child.localName, entries);
    }
  }
  return Object.fromEntries(values);
}
