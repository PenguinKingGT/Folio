/** Load a declared local navigation document without requiring a rendering surface. */
import { Navigation } from '../navigation/navigation';
import { parseNavigation } from '../navigation/parse';
import type { PublicationPackage } from '../package/types';
import { resolveResource } from '../resources/path';
import type { PublicationSource } from './source';

/** Prefer EPUB 3 navigation over NCX; no declared navigation produces an empty directory. */
export async function loadNavigation(
  publication: PublicationPackage,
  source: PublicationSource,
): Promise<Navigation> {
  const href = publication.navPath ?? publication.ncxPath;
  if (href === null) {
    return new Navigation([]);
  }
  const address = resolveResource(href, source.packagePath);
  if (address.kind !== 'local') {
    throw new TypeError('Publication navigation must be a local resource.');
  }
  const bytes = await source.read(address.path, source.signal);
  return parseNavigation(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
