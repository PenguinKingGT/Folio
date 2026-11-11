/** Public immutable CFI facade for textual position and range operations. */
import { collapseCfi, compareCfiPaths } from './compare';
import { parseCfi, serializeCfi } from './parse';
import type { CfiData } from './types';
import { assertionId } from './syntax';

/** A validated text CFI with lossless assertions and numeric positional comparison. */
export class Cfi {
  readonly data: CfiData;

  /** Parse a point or range CFI, optionally prefixed with a fragment marker. */
  constructor(source: string) {
    const data = parseCfi(source);
    const paths = [...data.paths];
    if (data.range !== null) {
      paths.push(data.range.start, data.range.end);
      Object.freeze(data.range);
    }
    for (const path of paths) {
      path.steps.forEach((step) => Object.freeze(step));
      Object.freeze(path.steps);
      Object.freeze(path);
    }
    Object.freeze(data.paths);
    this.data = Object.freeze(data);
    Object.freeze(this);
  }

  /** Return the zero-based OPF itemref position, or null for a non-publication path. */
  get spineIndex(): number | null {
    const value = this.data.paths[0]?.steps[1]?.value;
    if (this.data.paths.length < 2 || value === undefined || value % 2 !== 0) {
      return null;
    }
    return value / 2 - 1;
  }

  /** Report whether this CFI represents a range. */
  get isRange(): boolean {
    return this.data.range !== null;
  }

  /** Return the asserted OPF itemref ID, excluding extension parameters. */
  get spineId(): string | null {
    return this.spineIndex === null
      ? null
      : assertionId(this.data.paths[0]?.steps[1]?.assertion ?? null);
  }

  /** Compare using range starts; assertions do not affect ordering. */
  compare(other: Cfi | string): number {
    const right = typeof other === 'string' ? new Cfi(other) : other;
    return compareCfiPaths(collapseCfi(this.data, true).paths, collapseCfi(right.data, true).paths);
  }

  /** Return an independent point at the range start or end, preserving indirections. */
  collapse(toStart = true): Cfi {
    return new Cfi(serializeCfi(collapseCfi(this.data, toStart)));
  }

  /** Serialize the CFI without a URI fragment marker. */
  toString(): string {
    return serializeCfi(this.data);
  }
}
