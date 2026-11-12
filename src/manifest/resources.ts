/** Merge JSON resource identities with reading-order entries while preserving stable chapter CFIs. */
import { mimeType } from '../archive/mime';
import type { ManifestItem, SpineItem } from '../package/types';
import { dictionary, field, href, list, text, tokens } from './values';

/** Generate deterministic identities that cannot collide with an earlier explicitly declared resource. */
function identity(
  value: unknown,
  prefix: string,
  manifest: ReadonlyMap<string, ManifestItem>,
): string {
  if (value !== undefined) {
    return text(value, 'resource ID');
  }
  let index = manifest.size;
  while (manifest.has(`${prefix}-${index}`)) {
    index += 1;
  }
  return `${prefix}-${index}`;
}

/** Normalize a declared resource and cover/navigation relationships into the existing manifest model. */
function resource(value: Record<string, unknown>, id: string): ManifestItem {
  const path = href(value.href, 'resource href');
  if (path.startsWith('#')) {
    throw new TypeError('A manifest resource requires a document path.');
  }
  const relationships = tokens(value.rel, 'resource rel');
  const properties = new Set(tokens(value.properties, 'resource properties'));
  if (relationships.includes('cover')) {
    properties.add('cover-image');
  }
  if (relationships.includes('contents')) {
    properties.add('nav');
  }
  return {
    id,
    href: path,
    mediaType:
      value.type === undefined && value.mediaType === undefined
        ? mimeType(path.split(/[?#]/u, 1)[0] ?? path)
        : text(field(value, 'type', 'mediaType'), 'resource type'),
    properties: Array.from(properties),
    fallback: value.fallback === undefined ? null : text(value.fallback, 'fallback'),
    mediaOverlay:
      value.mediaOverlay === undefined ? null : text(value.mediaOverlay, 'media overlay'),
  };
}

/** Reuse an explicit manifest identity without erasing resource-level properties with spine overrides. */
function readingItem(
  value: Record<string, unknown>,
  manifest: Map<string, ManifestItem>,
): ManifestItem {
  const id = identity(field(value, 'idref', 'id'), 'section', manifest);
  const existing = manifest.get(id);
  let item = existing;
  const configuredType = field(value, 'type', 'mediaType');
  if (
    existing !== undefined &&
    configuredType !== undefined &&
    text(configuredType, 'resource type') !== existing.mediaType
  ) {
    throw new TypeError(`Conflicting JSON resource type: ${id}`);
  }
  if (value.href !== undefined) {
    const candidate = resource(
      {
        ...value,
        type:
          configuredType === undefined
            ? (existing?.mediaType ?? 'application/xhtml+xml')
            : configuredType,
      },
      id,
    );
    if (
      existing !== undefined &&
      (existing.href !== candidate.href || existing.mediaType !== candidate.mediaType)
    ) {
      throw new TypeError(`Conflicting JSON resource ID: ${id}`);
    }
    item = existing ?? candidate;
    manifest.set(id, item);
  }
  if (item === undefined || item.mediaType !== 'application/xhtml+xml') {
    throw new TypeError('JSON reading order requires a declared XHTML resource.');
  }
  return item;
}

/** Preserve legacy yes/no and boolean linear flags without treating false as an absent default. */
function linear(value: unknown): boolean {
  if (value === undefined || value === true || value === 'yes') {
    return true;
  }
  if (value === false || value === 'no') {
    return false;
  }
  throw new TypeError('JSON spine linear must be boolean, yes, or no.');
}

/** Read resources first so legacy idref-only spine entries can resolve them before creating chapters. */
export function manifestResources(root: Record<string, unknown>): {
  manifest: ReadonlyMap<string, ManifestItem>;
  spine: readonly SpineItem[];
} {
  const manifest = new Map<string, ManifestItem>();
  for (const entry of list(root.resources, 'resources', true)) {
    const value = dictionary(entry, 'resource');
    const id = identity(value.id, 'resource', manifest);
    if (manifest.has(id)) {
      throw new TypeError(`Duplicate JSON resource ID: ${id}`);
    }
    manifest.set(id, resource(value, id));
  }
  const spine = list(field(root, 'readingOrder', 'spine'), 'reading order').map((entry, index) => {
    const value = dictionary(entry, 'reading-order entry');
    const item = readingItem(value, manifest);
    return {
      idref: item.id,
      index,
      linear: linear(value.linear),
      properties: tokens(value.properties, 'spine properties'),
    };
  });
  if (spine.length === 0) {
    throw new TypeError('JSON reading order cannot be empty.');
  }
  for (const item of manifest.values()) {
    for (const reference of [item.fallback, item.mediaOverlay]) {
      if (reference !== null && !manifest.has(reference)) {
        throw new TypeError('Missing JSON manifest reference.');
      }
    }
  }
  return { manifest, spine };
}
