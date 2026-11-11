/** Enforce ZIP input and entry limits behind an extraction boundary. */
import { unzipSync } from 'fflate';
import { validateArchivePath } from './path';

/** Limit declared sizes before extraction and verify actual totals afterward. */
export interface ArchiveLimits {
  maxArchiveBytes?: number;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
  maxEntries?: number;
}

/** Extract within bounds; reject invalid ZIPs, duplicate paths, and excessive resources. */
export function extractArchive(input: Uint8Array, limits: ArchiveLimits): Map<string, Uint8Array> {
  const settings = {
    maxArchiveBytes: 50 * 1024 * 1024,
    maxEntryBytes: 20 * 1024 * 1024,
    maxTotalBytes: 100 * 1024 * 1024,
    maxEntries: 10_000,
    ...limits,
  };
  for (const value of Object.values(settings)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError('Archive limits must be positive safe integers.');
    }
  }
  if (input.byteLength > settings.maxArchiveBytes) {
    throw new RangeError('Compressed archive exceeds size limit.');
  }
  const names = new Set<string>();
  let total = 0;
  const entries = unzipSync(input, {
    filter: (entry) => {
      validateArchivePath(entry.name);
      if (names.has(entry.name)) {
        throw new TypeError(`Duplicate archive entry: ${entry.name}`);
      }
      names.add(entry.name);
      total += entry.originalSize;
      if (
        names.size > settings.maxEntries ||
        entry.originalSize > settings.maxEntryBytes ||
        total > settings.maxTotalBytes
      ) {
        throw new RangeError('Archive extraction exceeds resource limits.');
      }
      return !entry.name.endsWith('/');
    },
  });
  const result = new Map(Object.entries(entries));
  const actualTotal = [...result.values()].reduce((size, entry) => size + entry.byteLength, 0);
  if (actualTotal !== total) {
    throw new TypeError('Archive size declarations do not match extracted data.');
  }
  return result;
}
