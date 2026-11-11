/** Maintain estimated whole-book positions while keeping only a bounded chapter window alive. */
import type { Section } from '../spine/section';
import { lowerBound } from '../locations/search';

/** Atomic prefix sums support fast virtual-scroll target lookup and compensation. */
export class ChapterOffsets {
  private sections: readonly Section[];
  private starts: number[] = [];
  private slots = new Map<number, number>();
  private known = new Map<number, number>();
  private estimate = 1;

  /** Start from the linear reading order; non-linear chapters can be included explicitly. */
  constructor(sections: readonly Section[]) {
    this.sections = sections.filter((section) => section.linear);
    this.update([], 1);
  }

  /** Return a copy so callers cannot reorder the virtual spine. */
  all(): readonly Section[] {
    return this.sections.slice();
  }
  /** Return the complete estimated extent, including currently unloaded chapters. */
  get total(): number {
    return this.starts.at(-1) ?? 0;
  }
  /** Return the measured or estimated extent of one known spine section. */
  extent(index: number): number {
    return this.known.get(index) ?? this.estimate;
  }
  /** Return the global logical position at a section boundary. */
  start(index: number): number {
    return this.starts[this.slots.get(index) ?? -1] ?? 0;
  }

  /** Add an explicitly requested non-linear document without exposing every appendix by default. */
  include(section: Section): void {
    if (!this.slots.has(section.index)) {
      const sections = this.sections.slice();
      const slot = sections.findIndex((entry) => entry.index > section.index);
      sections.splice(slot === -1 ? sections.length : slot, 0, section);
      const previous = this.sections;
      this.sections = sections;
      try {
        this.update([], this.estimate);
      } catch (error) {
        this.sections = previous;
        throw error;
      }
    }
  }

  /** Replace estimates only after the candidate total fits practical browser layout bounds. */
  update(
    values: readonly { index: number; extent: number }[],
    estimate: number,
    reset = false,
  ): void {
    if (!Number.isFinite(estimate) || estimate <= 0) {
      throw new RangeError('Continuous estimates must be positive and finite.');
    }
    const known = reset ? new Map<number, number>() : new Map(this.known);
    for (const value of values) {
      known.set(value.index, value.extent);
    }
    const starts = [0];
    const slots = new Map<number, number>();
    let total = 0;
    for (const [slot, section] of this.sections.entries()) {
      const extent = known.get(section.index) ?? estimate;
      if (!Number.isFinite(extent) || extent <= 0) {
        throw new RangeError('Continuous chapter extents must be positive and finite.');
      }
      slots.set(section.index, slot);
      total += extent;
      if (total > 16_000_000) {
        throw new RangeError('Continuous estimated book extent exceeds the supported limit.');
      }
      starts.push(total);
    }
    this.known = known;
    this.starts = starts;
    this.slots = slots;
    this.estimate = estimate;
  }

  /** Select the chapter containing a logical offset, including estimated unloaded ranges. */
  at(offset: number): Section | null {
    if (!Number.isFinite(offset) || this.sections.length === 0) {
      return null;
    }
    const slot = Math.max(
      0,
      Math.min(this.sections.length - 1, lowerBound(this.starts, (start) => start > offset) - 1),
    );
    return this.sections[slot] ?? null;
  }

  /** Return a bounded contiguous window in logical reading order. */
  window(index: number, before: number, after: number): readonly Section[] {
    const slot = this.slots.get(index);
    return slot === undefined
      ? []
      : this.sections.slice(Math.max(0, slot - before), slot + after + 1);
  }

  /** Look up a neighboring virtual slot without scanning the whole spine. */
  adjacent(index: number, delta: number): Section | null {
    const slot = this.slots.get(index);
    return slot === undefined ? null : (this.sections[slot + delta] ?? null);
  }
}
