/** Discover optional legacy display metadata without suppressing malformed documents, cancellation, or server errors. */
import { HttpError } from '../input/request';
import { OfflineMissError } from '../offline/store';
import type { BookOptions } from './options';
import type { PublicationSource } from './source';
import type { PublicationPackage } from '../package/types';
import { parseAppleDisplayOptions } from '../display-options/parse';
import type { AppleDisplayOptions } from '../display-options/types';

const path = 'META-INF/com.apple.ibooks.display-options.xml';

/** Reject unsupported host options before opening any source or issuing requests. */
export function validateDisplayOptions(options: BookOptions): void {
  if (
    options.appleDisplayOptions !== undefined &&
    typeof options.appleDisplayOptions !== 'boolean'
  ) {
    throw new TypeError('appleDisplayOptions must be a boolean.');
  }
  if (
    options.applePlatform !== undefined &&
    !['*', 'ipad', 'iphone'].includes(options.applePlatform)
  ) {
    throw new TypeError('Unsupported Apple platform.');
  }
}

/** Archives use known entries; directory discovery fills missing layout metadata; direct documents require opt-in. */
export async function loadDisplayOptions(
  source: PublicationSource,
  publication: PublicationPackage,
  options: BookOptions,
): Promise<AppleDisplayOptions | null> {
  if (options.appleDisplayOptions === false || source.contains?.(path) === false) {
    return null;
  }
  if (
    options.appleDisplayOptions !== true &&
    (source.kind === 'document' ||
      (source.kind === 'directory' && publication.rendition.layout !== undefined))
  ) {
    return null;
  }
  try {
    const bytes = await source.read(path, source.signal);
    source.signal.throwIfAborted();
    return parseAppleDisplayOptions(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      options.applePlatform,
    );
  } catch (error) {
    if ((error instanceof HttpError && error.status === 404) || error instanceof OfflineMissError) {
      return null;
    }
    throw error;
  }
}
