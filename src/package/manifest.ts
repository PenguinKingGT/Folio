/** Parse resource identities and validate references before constructing reading order. */
import type { Element } from '@xmldom/xmldom';
import { children } from '../xml/parse';
import { opfNamespace, requiredAttribute, tokens } from './helpers';
import type { ManifestItem, SpineItem } from './types';

/** Parse manifest resources and reject ambiguous IDs and dangling fallback references. */
export function parseManifest(element: Element): Map<string, ManifestItem> {
  const manifest = new Map<string, ManifestItem>();
  for (const item of children(element, 'item', opfNamespace)) {
    const id = requiredAttribute(item, 'id');
    if (manifest.has(id)) {
      throw new TypeError(`Duplicate manifest ID: ${id}`);
    }
    manifest.set(id, {
      id,
      href: requiredAttribute(item, 'href'),
      mediaType: requiredAttribute(item, 'media-type'),
      properties: tokens(item.getAttribute('properties')),
      fallback: item.getAttribute('fallback'),
      mediaOverlay: item.getAttribute('media-overlay'),
    });
  }
  for (const item of manifest.values()) {
    for (const reference of [item.fallback, item.mediaOverlay]) {
      if (reference !== null && !manifest.has(reference)) {
        throw new TypeError(`Missing manifest reference: ${reference}`);
      }
    }
  }
  return manifest;
}

/** Parse all spine entries, including linear="no", with stable zero-based indexes. */
export function parseSpine(
  element: Element,
  manifest: ReadonlyMap<string, ManifestItem>,
): SpineItem[] {
  const spine = children(element, 'itemref', opfNamespace).map((entry, index) => {
    const idref = requiredAttribute(entry, 'idref');
    if (!manifest.has(idref)) {
      throw new TypeError(`Spine references missing resource: ${idref}`);
    }
    const linear = entry.getAttribute('linear') ?? 'yes';
    if (linear !== 'yes' && linear !== 'no') {
      throw new TypeError('Spine linear must be yes or no.');
    }
    return {
      idref,
      index,
      linear: linear === 'yes',
      properties: tokens(entry.getAttribute('properties')),
    };
  });
  if (spine.length === 0) {
    throw new TypeError('Package spine cannot be empty.');
  }
  return spine;
}
