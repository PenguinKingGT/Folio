/** Normalize supported epub.js-style JSON publications into the same package/navigation model used by EPUB files. */
import type { PublicationPackage } from '../package/types';
import type { Navigation } from '../navigation/navigation';
import { dictionary } from './values';
import { manifestMetadata, manifestDirection, manifestRendition } from './metadata';
import { manifestResources } from './resources';
import { manifestNavigation } from './navigation';

/** Inline navigation is optional; declared nav resources retain their existing loading behavior when absent. */
export interface JsonPublication {
  publication: PublicationPackage;
  navigation: Navigation | undefined;
}

/** Parse text or a validated host object without mutating its reading order or metadata. */
export function parseJsonManifest(input: unknown): JsonPublication {
  let value = input;
  if (typeof value === 'string') {
    if (value.length > 5 * 1024 * 1024) {
      throw new RangeError('JSON manifest exceeds the document size limit.');
    }
    const parsed: unknown = JSON.parse(value);
    value = parsed;
  }
  const root = dictionary(value, 'JSON publication');
  const metadata = dictionary(root.metadata, 'metadata');
  const { manifest, spine } = manifestResources(root);
  const items = Array.from(manifest.values());
  const navigation = manifestNavigation(root);
  return {
    publication: {
      version: '3.0',
      metadata: manifestMetadata(metadata),
      manifest,
      spine,
      spineStep: 6,
      direction: manifestDirection(metadata),
      rendition: manifestRendition(metadata),
      navPath:
        navigation === undefined
          ? (items.find((entry) => entry.properties.includes('nav'))?.href ?? null)
          : null,
      ncxPath:
        navigation === undefined
          ? (items.find((entry) => entry.mediaType === 'application/x-dtbncx+xml')?.href ?? null)
          : null,
      coverPath: items.find((entry) => entry.properties.includes('cover-image'))?.href ?? null,
    },
    navigation,
  };
}
