/** Public layout-independent reading progress, generation, lookup, and persistence. */
import { Cfi } from '../cfi/cfi';
import { EventEmitter } from '../events/emitter';
import { isAbortError } from '../events/errors';
import type { LocationsEventMap } from '../events/types';
import { withAbort } from '../async/cancellation';
import type { PublicationPackage } from '../package/types';
import { generateLocations } from './generate';
import { lowerBound } from './search';
import { loadLocations } from './storage';
import type { LocationLoader, LocationOptions, LocationSnapshot, ReadingLocation } from './types';

/** Own one atomically replaceable character/word index for a publication. */
export class Locations extends EventEmitter<LocationsEventMap> {
  private snapshot: LocationSnapshot;
  private generating: AbortController | undefined;
  private destroyed = false;

  /** Bind publication identity and a chapter loader without starting any reads. */
  constructor(
    private readonly publication: PublicationPackage,
    private readonly loadChapter: LocationLoader,
  ) {
    super();
    this.snapshot = {
      version: 1,
      identifier: publication.metadata.identifier,
      unit: 'characters',
      breakSize: 150,
      total: 0,
      current: null,
      locations: Object.freeze([]),
    };
  }

  /** Return the immutable sampled positions in reading order. */
  get entries(): readonly ReadingLocation[] {
    return this.snapshot.locations;
  }

  /** Return the number of indexed reading units, not the sample count. */
  get total(): number {
    return this.snapshot.total;
  }

  /** Report whether total and sampled positions count characters or words. */
  get unit(): LocationSnapshot['unit'] {
    return this.snapshot.unit;
  }

  /** Report the configured sampling interval of the current snapshot. */
  get breakSize(): number {
    return this.snapshot.breakSize;
  }

  /** Return the number of available CFI samples. */
  get length(): number {
    return this.snapshot.locations.length;
  }

  /** Return the current sample index, or null before generation / for an empty publication. */
  get current(): number | null {
    return this.snapshot.current;
  }

  /** Generate an index atomically; cancellation, errors, or newer requests preserve previous results. */
  async generate(options: LocationOptions = {}): Promise<readonly ReadingLocation[]> {
    this.assertActive();
    try {
      const entries = await this.generateIndex(options);
      this.emit('generated', entries);
      return entries;
    } catch (error) {
      if (!isAbortError(error)) {
        this.emit('error', error);
      }
      throw error;
    }
  }

  /** Commit one generation before notifying typed subscribers. */
  private async generateIndex(options: LocationOptions): Promise<readonly ReadingLocation[]> {
    this.generating?.abort();
    const controller = new AbortController();
    this.generating = controller;
    const signal =
      options.signal === undefined
        ? controller.signal
        : AbortSignal.any([controller.signal, options.signal]);
    signal.throwIfAborted();
    const snapshot = await withAbort(
      generateLocations(this.publication, this.loadChapter, options, signal),
      signal,
    );
    signal.throwIfAborted();
    this.snapshot = snapshot;
    return snapshot.locations;
  }

  /** Find the nearest preceding sample by structural CFI ordering; empty indexes return null. */
  locationFromCfi(value: string): number | null {
    this.assertActive();
    if (this.length === 0) {
      return null;
    }
    const target = new Cfi(value);
    const section = this.publication.spine[target.spineIndex ?? -1];
    if (
      section === undefined ||
      !section.linear ||
      target.data.paths.length !== 2 ||
      (target.spineId !== null && target.spineId !== section.idref)
    ) {
      return null;
    }
    return Math.max(
      0,
      lowerBound(this.entries, (entry) => new Cfi(entry.cfi).compare(target) > 0) - 1,
    );
  }

  /** Convert a valid sample index to its sampled CFI; missing indexes return null. */
  cfiFromLocation(index: number): string | null {
    this.assertActive();
    return this.entries[index]?.cfi ?? null;
  }

  /** Convert a sample index to progress weighted by actual indexed units. */
  percentageFromLocation(index: number): number {
    this.assertActive();
    const entry = this.entries[index];
    if (entry === undefined) {
      throw new RangeError('Location index is out of range.');
    }
    return this.total === 0 ? 0 : entry.position / this.total;
  }

  /** Convert a CFI to sampled progress, or null before an index is available. */
  percentageFromCfi(value: string): number | null {
    const index = this.locationFromCfi(value);
    return index === null ? null : this.percentageFromLocation(index);
  }

  /** Select a preceding sample at a finite progress value from zero through one. */
  cfiFromPercentage(value: number): string | null {
    this.assertActive();
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError('Progress must be between zero and one.');
    }
    const position = value * this.total;
    const index = Math.max(0, lowerBound(this.entries, (entry) => entry.position > position) - 1);
    return this.cfiFromLocation(index);
  }

  /** Set the current sample by index or CFI. */
  setCurrent(target: number | string): void {
    this.assertActive();
    const index = typeof target === 'number' ? target : this.locationFromCfi(target);
    if (index === null || !Number.isInteger(index) || this.entries[index] === undefined) {
      throw new RangeError('Current reading location is out of range.');
    }
    if (this.snapshot.current === index) {
      return;
    }
    this.snapshot = { ...this.snapshot, current: index };
    const cfi = this.cfiFromLocation(index);
    if (cfi !== null) {
      this.emit(
        'changed',
        Object.freeze({ index, cfi, percentage: this.percentageFromLocation(index) }),
      );
    }
  }

  /** Serialize the current versioned snapshot; very large indexes require a coarser sample interval. */
  save(): string {
    this.assertActive();
    const result = JSON.stringify(this.snapshot);
    if (result.length > 10 * 1024 * 1024) {
      throw new RangeError('Saved location data exceeds the size limit.');
    }
    return result;
  }

  /** Restore validated data for this publication, cancelling in-flight generation. */
  load(input: unknown): readonly ReadingLocation[] {
    this.assertActive();
    const snapshot = loadLocations(input, this.publication);
    this.generating?.abort();
    this.snapshot = snapshot;
    this.emit('restored', snapshot.locations);
    return snapshot.locations;
  }

  /** Cancel work and release the sampled index; safe to repeat. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.generating?.abort();
    this.snapshot = { ...this.snapshot, locations: Object.freeze([]), total: 0, current: null };
    this.destroyed = true;
    this.finishEvents('destroyed', undefined);
  }

  /** Reject state-changing and lookup operations after cleanup. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Locations have been destroyed.');
    }
  }
}
