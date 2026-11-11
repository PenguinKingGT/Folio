/** Parse OPF metadata without flattening refinements or repeated creator fields. */
import type { Element } from '@xmldom/xmldom';
import { children } from '../xml/parse';
import { dcNamespace, opfNamespace } from './helpers';
import type { MetadataEntry, PackageMetadata } from './types';

/** Parse Dublin Core and extension metadata; resolve the package's unique identifier. */
export function parseMetadata(element: Element, identifierId: string): PackageMetadata {
  const identifiers = children(element, 'identifier', dcNamespace);
  const identifier = identifiers.find((entry) => entry.getAttribute('id') === identifierId);
  const identifierValue = (identifier?.textContent || '').trim();
  if (identifierValue === '') {
    throw new TypeError('Package unique identifier does not resolve to metadata.');
  }
  /** Read the first normalized Dublin Core value, preserving missing optional fields as empty. */
  const first = (name: string): string =>
    (children(element, name, dcNamespace)[0]?.textContent || '').trim();
  const entries: MetadataEntry[] = children(element, 'meta', opfNamespace).map((entry) => ({
    name: entry.getAttribute('property') ?? entry.getAttribute('name') ?? '',
    value: entry.getAttribute('content') ?? (entry.textContent || '').trim(),
    id: entry.getAttribute('id'),
    refines: entry.getAttribute('refines'),
  }));
  const title = first('title');
  const language = first('language');
  if (title === '' || language === '') {
    throw new TypeError('Package title and language are required.');
  }
  return {
    title,
    language,
    identifier: identifierValue,
    creators: children(element, 'creator', dcNamespace).map((creator) =>
      (creator.textContent || '').trim(),
    ),
    description: first('description'),
    publisher: first('publisher'),
    date: first('date'),
    rights: first('rights'),
    entries,
  };
}
