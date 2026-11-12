/** Attach standard font restoration to the shared byte boundary of known OCF ZIP containers. */
import type { PublicationSource } from './source';
import type { PublicationPackage } from '../package/types';
import { withAbort } from '../async/cancellation';
import { obfuscatedFonts } from '../obfuscation/metadata';
import { idpfKey, restoreIdpfFont } from '../obfuscation/idpf';

const metadataPath = 'META-INF/encryption.xml';

/**
 * Decorate only recognized font reads; archives, offline storage, and unrelated resources retain their original bytes.
 * Discovery uses the ZIP directory. Extracted directories and direct OPF/JSON documents are not probed for metadata.
 * @throws Invalid encryption metadata, digest/transport errors, or cancellation; Book.open owns failure cleanup.
 */
export async function fontSource(
  source: PublicationSource,
  publication: PublicationPackage,
): Promise<PublicationSource> {
  source.signal.throwIfAborted();
  if (source.contains?.(metadataPath) !== true) {
    return source;
  }
  const metadataBytes = await withAbort(source.read(metadataPath, source.signal), source.signal);
  const targets = obfuscatedFonts(
    new TextDecoder('utf-8', { fatal: true }).decode(metadataBytes),
    publication,
    source.packagePath,
  );
  if (targets.size === 0) {
    return source;
  }
  const key = await withAbort(idpfKey(source.package.source), source.signal);
  source.signal.throwIfAborted();
  return {
    ...source,
    read: async (path, consumer) => {
      const signal = AbortSignal.any([consumer, source.signal]);
      signal.throwIfAborted();
      const bytes = await withAbort(source.read(path, signal), signal);
      return targets.has(path) ? restoreIdpfFont(bytes, key) : bytes;
    },
  };
}
