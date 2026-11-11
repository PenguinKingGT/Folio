/** Retain one logical reading point through repeated reflow until a real scroll changes it. */
import type { VisibleLocation } from '../render/location-types';
import type { ContinuousPort } from './port';
import type { ContinuousWindow } from './window';
import { readingReference } from './position';
import type { ReadingReference } from './position';

/** Distinguish scroll compensation from new native reading intent. */
export class ReadingAnchor {
  private reference: ReadingReference | null = null;
  private offset = -1;

  /** Read fresh snapshots only while the previous measured geometry remains valid. */
  constructor(
    private readonly port: ContinuousPort,
    private readonly window: ContinuousWindow,
    private readonly snapshot: () => VisibleLocation | null,
  ) {}

  /** Preserve the logical point while resize invalidates the browser's old pixel coordinate. */
  capture(preserve: boolean): ReadingReference | null {
    if (this.reference === null || (!preserve && this.offset !== this.port.offset())) {
      this.reference = readingReference(this.port, this.window, this.snapshot());
      this.offset = this.port.offset();
    }
    return this.reference;
  }

  /** Adopt user scrolling, excluding the compensated position recorded by remember(). */
  observe(snapshot: VisibleLocation): void {
    if (this.offset !== this.port.offset()) {
      this.reference = readingReference(this.port, this.window, snapshot);
      this.offset = this.port.offset();
    }
  }

  /** Refresh pixel coordinates after compensation while retaining the original logical CFI. */
  remember(reference: ReadingReference | null): void {
    const fresh = readingReference(this.port, this.window, this.snapshot());
    this.reference =
      reference !== null && fresh?.index === reference.index
        ? { ...fresh, cfi: reference.cfi }
        : fresh;
    this.offset = this.port.offset();
  }
}
