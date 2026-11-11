/** Small XML helpers local to OPF parsing. */
import type { Element } from '@xmldom/xmldom';
import { children } from '../xml/parse';

export const opfNamespace = 'http://www.idpf.org/2007/opf';
export const dcNamespace = 'http://purl.org/dc/elements/1.1/';

/** Require an attribute with non-whitespace content. */
export function requiredAttribute(element: Element, name: string): string {
  const value = element.getAttribute(name)?.trim();
  if (value === undefined || value.length === 0) {
    throw new TypeError(`Missing ${name} on ${element.localName}.`);
  }
  return value;
}

/** Select exactly one direct OPF child. */
export function requiredChild(root: Element, name: string): Element {
  const matches = children(root, name, opfNamespace);
  const result = matches[0];
  if (matches.length !== 1 || result === undefined) {
    throw new TypeError(`Package must contain exactly one ${name}.`);
  }
  return result;
}

/** Tokenize XML whitespace-separated properties without empty entries. */
export function tokens(value: string | null): string[] {
  return value?.trim().split(/\s+/).filter(Boolean) ?? [];
}
