/** Compose namespace-aware OPF parsers into a validated publication model. */
import { parseXml } from '../xml/parse';
import { opfNamespace, requiredAttribute, requiredChild } from './helpers';
import { parseManifest, parseSpine } from './manifest';
import { parseMetadata } from './metadata';
import type { ManifestItem, PackageMetadata, PublicationPackage } from './types';

/** Discover EPUB 3 cover-image or the EPUB 2 cover meta reference. */
function coverPath(
  manifest: ReadonlyMap<string, ManifestItem>,
  metadata: PackageMetadata,
): string | null {
  const cover = [...manifest.values()].find((item) => item.properties.includes('cover-image'));
  const legacyId = metadata.entries.find((entry) => entry.name === 'cover')?.value;
  return cover?.href ?? manifest.get(legacyId ?? '')?.href ?? null;
}

/**
 * Parse an EPUB 2/3 OPF package; paths remain relative to its document URL.
 * @throws TypeError for missing metadata, duplicate IDs, or invalid references.
 * @see https://www.w3.org/TR/epub-33/#sec-package-doc
 */
export function parsePackage(source: string): PublicationPackage {
  const root = parseXml(source).documentElement;
  if (root === null || root.localName !== 'package' || root.namespaceURI !== opfNamespace) {
    throw new TypeError('Expected an OPF package root.');
  }
  const version = requiredAttribute(root, 'version');
  if (!/^([23])\.\d+$/.test(version)) {
    throw new TypeError(`Unsupported EPUB version: ${version}`);
  }
  const metadata = parseMetadata(
    requiredChild(root, 'metadata'),
    requiredAttribute(root, 'unique-identifier'),
  );
  const manifest = parseManifest(requiredChild(root, 'manifest'));
  const spineElement = requiredChild(root, 'spine');
  const spine = parseSpine(spineElement, manifest);
  const direction = spineElement.getAttribute('page-progression-direction') ?? 'default';
  if (direction !== 'ltr' && direction !== 'rtl' && direction !== 'default') {
    throw new TypeError('Invalid page progression direction.');
  }
  const nav = [...manifest.values()].find((item) => item.properties.includes('nav'));
  const ncxId = spineElement.getAttribute('toc');
  const ncx = manifest.get(ncxId ?? '');
  if (ncxId !== null && ncx === undefined) {
    throw new TypeError('Spine TOC references a missing manifest resource.');
  }
  const rendition = Object.fromEntries(
    metadata.entries
      .filter((entry) => entry.refines === null && entry.name.startsWith('rendition:'))
      .map((entry) => [entry.name.slice(10), entry.value]),
  );
  return {
    version,
    metadata,
    manifest,
    spine,
    direction,
    rendition,
    navPath: nav?.href ?? null,
    ncxPath: ncx?.href ?? null,
    coverPath: coverPath(manifest, metadata),
  };
}
