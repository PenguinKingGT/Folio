/** Observe native chapter scrolling and deduplicate immutable relocation notifications. */
import { NativeScrollMonitor, nativeScrollCallbacks } from './native-scroll';
import type { RelocatedListener, VisibleLocation } from './location-types';

/** Own native listeners, animation-frame work, and subscriber lifetime for one reader. */
export class Relocations {
  private readonly listeners = new Set<RelocatedListener>();
  private window: Window | null = null;
  private controller: AbortController | undefined;
  private pending: number | undefined;
  private previous = '';
  private monitor: NativeScrollMonitor | undefined;
  private generation = 0;

  /** Defer geometry reads until a caller or native scroll requests a snapshot. */
  constructor(
    private readonly read: () => VisibleLocation | null,
    private readonly scheduler: Window | null,
    private readonly scrolled?: () => void,
  ) {}

  /** Register a listener; the returned unsubscribe operation is idempotent. */
  subscribe(listener: RelocatedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Replace chapter listeners after display and emit the initial visible location. */
  watch(document: Document): void {
    this.detach();
    this.window = document.defaultView;
    this.controller = new AbortController();
    const changed = () => this.schedule();
    this.window?.addEventListener('scroll', changed, {
      passive: true,
      signal: this.controller.signal,
    });
    if (this.window !== null && !nativeScrollCallbacks(document)) {
      this.monitor = new NativeScrollMonitor(this.window, this.scheduler, changed);
    }
    this.report();
  }

  /** Publish only changed snapshots and return whether subscribers received one; synchronous commands can report immediately. */
  report(): boolean {
    if (this.window === null || this.listeners.size === 0) {
      return false;
    }
    const location = this.read();
    const key = JSON.stringify(location);
    if (location === null || key === this.previous) {
      return false;
    }
    this.previous = key;
    // Snapshot subscribers so callbacks can unsubscribe or subscribe during dispatch.
    const generation = this.generation;
    const listeners = Array.from(this.listeners);
    for (const listener of listeners) {
      if (generation !== this.generation) {
        break;
      }
      listener(location);
    }
    return true;
  }

  /** Coalesce native scroll events into one geometry read per animation frame. */
  private schedule(): void {
    if (this.pending === undefined) {
      // Keep animation-frame work outside script-disabled publication documents.
      this.pending = this.scheduler?.requestAnimationFrame(() => {
        this.pending = undefined;
        if (!this.report()) {
          this.scrolled?.();
        }
      });
    }
  }

  /** Stop old-document observations and cancel pending work before replacing an iframe document. */
  detach(): void {
    this.controller?.abort();
    this.monitor?.destroy();
    this.monitor = undefined;
    if (this.pending !== undefined) {
      this.scheduler?.cancelAnimationFrame(this.pending);
    }
    this.pending = undefined;
    this.window = null;
    this.previous = '';
  }

  /** Detach observations and release every subscriber; safe to repeat. */
  destroy(): void {
    this.detach();
    this.generation++;
    this.listeners.clear();
  }
}
