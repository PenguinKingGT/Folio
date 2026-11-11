/** Resolve printed-page links atomically and convert labels, CFIs, and ordinal percentages. */
import { Cfi } from '../cfi/cfi';
import { lowerBound } from '../locations/search';
import { withAbort } from '../async/cancellation';
import type { PrintPage, PrintPageLink, PrintPageResolver } from './types';

/** Extract a direct CFI destination without confusing ordinary fragment IDs with CFIs. */
function directCfi(href: string): string | null {
  const fragment = decodeURIComponent(href.slice(href.indexOf('#') + 1));
  return fragment.startsWith('epubcfi(') ? new Cfi(fragment).toString() : null;
}

/** Normalize public constructor inputs without coercing meaningful printed labels. */
function normalizePage(link: PrintPageLink, index: number): PrintPage {
  const label = link.label.trim().replace(/\s+/g, ' ');
  const href = link.href.trim();
  if (label === '' || href === '') {
    throw new TypeError('Print-page entries require a label and href.');
  }
  return Object.freeze({ ...link, label, href, index, cfi: directCfi(href) });
}

/** Only complete, nondecreasing CFI tables support positional reverse lookup. */
function positioned(entries: readonly PrintPage[]): boolean {
  let previous: Cfi | null = null;
  let complete = true;
  for (const entry of entries) {
    if (entry.cfi === null) {
      complete = false;
      continue;
    }
    const current = new Cfi(entry.cfi);
    if (previous !== null && previous.compare(current) > 0) {
      throw new TypeError('Print-page destinations must follow reading order.');
    }
    previous = current;
  }
  return complete;
}

/** Keep authored labels and sparse numbering independent of document-order progress. */
export class PageList {
  private values: readonly PrintPage[];
  private indexed: boolean;
  private controller: AbortController | undefined;
  private destroyed = false;

  /** Bind an optional asynchronous resolver; direct-CFI-only lists work without chapter loading. */
  constructor(
    links: readonly PrintPageLink[] = [],
    private readonly resolve?: PrintPageResolver,
  ) {
    if (links.length > 10_000) {
      throw new RangeError('Print-page list exceeds the supported limit.');
    }
    this.values = Object.freeze(links.map(normalizePage));
    this.indexed = positioned(this.values);
  }

  /** Return immutable printed-page entries; unresolved destinations have null CFIs. */
  get entries(): readonly PrintPage[] {
    return this.values;
  }
  /** Return the number of authored destinations, including repeated page labels. */
  get length(): number {
    return this.values.length;
  }

  /** Resolve all links atomically; newer generation, failure, and cancellation preserve prior data. */
  async generate(options: { signal?: AbortSignal } = {}): Promise<readonly PrintPage[]> {
    this.assertActive();
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const signal =
      options.signal === undefined
        ? controller.signal
        : AbortSignal.any([controller.signal, options.signal]);
    signal.throwIfAborted();
    const entries: PrintPage[] = [];
    for (const page of this.values) {
      const operation = this.resolve?.(page, signal);
      const cfi = operation === undefined ? page.cfi : await withAbort(operation, signal);
      signal.throwIfAborted();
      if (cfi === null) {
        throw new TypeError('Unresolved print pages require a destination resolver.');
      }
      entries.push(Object.freeze({ ...page, cfi: new Cfi(cfi).toString() }));
    }
    positioned(entries);
    this.values = Object.freeze(entries);
    this.indexed = true;
    return this.values;
  }

  /** Find the first matching printed label; numbers refer to printed numbering, not entry indices. */
  get(label: number | string): PrintPage | null {
    this.assertActive();
    return this.values.find((entry) => entry.label === String(label)) ?? null;
  }

  /** Address repeated labels unambiguously by zero-based document order. */
  at(index: number): PrintPage | null {
    this.assertActive();
    return this.values[index] ?? null;
  }

  /** Return a page destination, or null until that destination has been resolved. */
  cfiFromPage(label: number | string): string | null {
    return this.get(label)?.cfi ?? null;
  }

  /** Return the preceding printed page; positions before the first marker have no printed page. */
  pageFromCfi(value: string): PrintPage | null {
    this.assertActive();
    if (!this.indexed || this.length === 0) {
      return null;
    }
    const target = new Cfi(value);
    const index =
      lowerBound(this.values, (entry) => new Cfi(entry.cfi ?? '').compare(target) > 0) - 1;
    return this.at(index);
  }

  /** Convert a positional query to the actual preceding entry's progress, including repeated labels. */
  percentageFromCfi(value: string): number | null {
    const page = this.pageFromCfi(value);
    return page === null ? null : page.index / Math.max(1, this.length - 1);
  }

  /** Convert a printed label to ordinal progress; a single listed page starts at zero. */
  percentageFromPage(label: number | string): number | null {
    const page = this.get(label);
    return page === null ? null : page.index / Math.max(1, this.length - 1);
  }

  /** Select a preceding entry by ordinal progress, independent of Roman or sparse labels. */
  pageFromPercentage(percentage: number): PrintPage | null {
    this.assertActive();
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 1) {
      throw new RangeError('Progress must be between zero and one.');
    }
    return this.at(Math.floor(percentage * Math.max(0, this.length - 1)));
  }

  /** Convert ordinal page progress to its resolved CFI, or null for an unresolved/empty list. */
  cfiFromPercentage(percentage: number): string | null {
    return this.pageFromPercentage(percentage)?.cfi ?? null;
  }

  /** Cancel work and release retained page entries; safe to repeat. */
  destroy(): void {
    this.controller?.abort();
    this.values = Object.freeze([]);
    this.destroyed = true;
  }

  /** Fail consistently after publication cleanup. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('PageList has been destroyed.');
    }
  }
}
