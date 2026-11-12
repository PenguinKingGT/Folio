/** Apply legacy display preferences only where modern package metadata has not supplied a value. */
import type { PublicationPackage } from '../package/types';
import type { AppleDisplayOptions } from './types';

/** Orientation remains a host-readable preference and interactive metadata never grants script permission. */
export function applyAppleDisplayOptions(
  publication: PublicationPackage,
  options: AppleDisplayOptions | null,
): PublicationPackage {
  if (options === null) {
    return publication;
  }
  const fallback: Record<string, string> = {};
  if (options.fixedLayout !== null) {
    fallback.layout = options.fixedLayout ? 'pre-paginated' : 'reflowable';
  }
  if (options.openToSpread !== null) {
    fallback.spread = options.openToSpread ? 'both' : 'none';
  }
  if (options.orientationLock !== null) {
    fallback.orientation =
      options.orientationLock === 'none' ? 'auto' : options.orientationLock.replace('-only', '');
  }
  return { ...publication, rendition: { ...fallback, ...publication.rendition } };
}
