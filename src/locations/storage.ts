/** Validate persisted indexes as untrusted data before replacing live progress state. */
import { Cfi } from '../cfi/cfi';
import type { PublicationPackage } from '../package/types';
import type { LocationSnapshot, ReadingLocation } from './types';

/** Narrow plain structured data without accepting arrays or null. */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Counts and indexes must be bounded non-negative safe integers. */
function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Validate each point's identity, ordering, and position against the target publication. */
function locationsFrom(
  values: unknown[],
  publication: PublicationPackage,
  total: number,
): readonly ReadingLocation[] {
  const result: ReadingLocation[] = [];
  let previous: Cfi | undefined;
  let position = -1;
  for (const value of values) {
    if (
      !record(value) ||
      typeof value.cfi !== 'string' ||
      !count(value.position) ||
      value.position < position ||
      value.position > total
    ) {
      throw new TypeError('Invalid saved location entry.');
    }
    const cfi = new Cfi(value.cfi);
    const base = cfi.data.paths[0];
    const item = publication.spine[cfi.spineIndex ?? -1];
    if (
      cfi.isRange ||
      cfi.data.paths.length !== 2 ||
      base?.steps.length !== 2 ||
      base.steps[0]?.value !== publication.spineStep ||
      item === undefined ||
      !item.linear ||
      (cfi.spineId !== null && cfi.spineId !== item.idref) ||
      (previous !== undefined && previous.compare(cfi) >= 0)
    ) {
      throw new TypeError('Saved locations have invalid CFIs or ordering.');
    }
    result.push(Object.freeze({ cfi: cfi.toString(), position: value.position }));
    previous = cfi;
    position = value.position;
  }
  if (
    result.length > 0 &&
    (result[0]?.position !== 0 || result[result.length - 1]?.position !== total)
  ) {
    throw new TypeError('Saved progress must include both endpoint positions.');
  }
  return Object.freeze(result);
}

/** Parse versioned JSON or object data; malformed snapshots leave the current index untouched. */
export function loadLocations(input: unknown, publication: PublicationPackage): LocationSnapshot {
  if (typeof input === 'string' && input.length > 10 * 1024 * 1024) {
    throw new RangeError('Saved location data exceeds the size limit.');
  }
  const data: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  if (
    !record(data) ||
    data.version !== 1 ||
    data.identifier !== publication.metadata.identifier ||
    (data.unit !== 'characters' && data.unit !== 'words') ||
    !count(data.breakSize) ||
    data.breakSize === 0 ||
    !count(data.total) ||
    !Array.isArray(data.locations) ||
    data.locations.length > 100_000
  ) {
    throw new TypeError('Invalid or mismatched location snapshot.');
  }
  const values: unknown[] = data.locations;
  const locations = locationsFrom(values, publication, data.total);
  if (
    (locations.length === 0 && (data.total !== 0 || data.current !== null)) ||
    (locations.length > 0 && (!count(data.current) || data.current >= locations.length))
  ) {
    throw new TypeError('Saved current location is out of range.');
  }
  return {
    version: 1,
    identifier: publication.metadata.identifier,
    unit: data.unit,
    breakSize: data.breakSize,
    total: data.total,
    current: typeof data.current === 'number' ? data.current : null,
    locations,
  };
}
