/** Own continuous reader notification deduplication, error state, and subscription cleanup. */
import { Listeners } from '../events/listeners';
import type { VisibleLocation } from '../render/location-types';

/** Notification state remains independent of geometry and asynchronous chapter preparation. */
export class ContinuousEvents {
  readonly relocations = new Listeners<VisibleLocation>();
  readonly errors = new Listeners<unknown>();
  lastError: unknown = null;
  private key = '';
  private active = true;

  /** Report changed snapshots without duplicating stable CFI/viewport notifications. */
  report(location: VisibleLocation): void {
    const key = JSON.stringify(location);
    if (this.active && key !== this.key) {
      this.key = key;
      this.relocations.emit(location);
    }
  }

  /** Preserve a background failure until the next explicit display starts. */
  fail(error: unknown): void {
    if (this.active) {
      this.lastError = error;
      this.errors.emit(error);
    }
  }

  /** Stop notifications and release all subscribers and retained error values. */
  destroy(): void {
    this.active = false;
    this.lastError = null;
    this.relocations.clear();
    this.errors.clear();
  }
}
