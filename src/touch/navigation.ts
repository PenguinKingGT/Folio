/** Own touch bindings for ready paginated documents and expose asynchronous gesture errors explicitly. */
import type { Rendition } from '../render/rendition';
import type { ContinuousReader } from '../continuous/reader';
import { scrollOffset, scrollToOffset, lastOffset } from '../render/position';
import { touchOptions } from './options';
import type { TouchSettings } from './options';
import { TouchBinding } from './binding';
import type { TouchGeometry } from './binding';

/** Gesture subscriptions share the reader lifetime and never enable publication scripts. */
export class TouchNavigation {
  private readonly settings;
  private readonly bindings = new Map<Document, TouchBinding>();
  private readonly surfaces = new Set<TouchBinding>();
  private readonly unsubscribe: (() => void) | undefined;
  private pending: Promise<unknown> = Promise.resolve();
  private busy = false;
  private destroyed = false;
  private failure: unknown = null;

  /** Subscribe lazily; natural document/continuous scrolling does not acquire pagination gestures. */
  constructor(
    private readonly reader: Rendition | ContinuousReader,
    value: TouchSettings['touch'],
  ) {
    this.settings = touchOptions(value);
    if (this.settings !== null) {
      this.unsubscribe = reader.onRelocated(() => this.refresh());
      this.refresh();
    }
  }

  /** Retain the latest gesture failure until another accepted gesture starts. */
  get lastError(): unknown {
    return this.failure;
  }

  /** Bind current spread documents and release replaced chapters or a newly selected scrolling mode. */
  refresh(): void {
    if (this.destroyed || this.settings === null) {
      return;
    }
    const documents =
      this.geometry() === null ? [] : this.reader.getRenderedPages().map((page) => page.document);
    for (const [document, binding] of this.bindings) {
      if (!documents.includes(document)) {
        binding.destroy();
        this.bindings.delete(document);
      }
    }
    for (const document of documents) {
      const binding = this.bindings.get(document);
      if (binding === undefined) {
        this.bindings.set(
          document,
          new TouchBinding(
            document,
            this.settings,
            () => this.geometry(),
            (direction) => this.turn(direction),
            () => this.snap(),
          ),
        );
      } else {
        binding.refresh();
      }
    }
    for (const binding of this.surfaces) {
      binding.refresh();
    }
  }

  /** Bind a caller-owned host gesture area, including engines that suppress passive-frame callbacks.
   * The returned release operation is idempotent; the reader also owns binding cleanup.
   */
  bind(surface: HTMLElement): () => void {
    if (this.destroyed || this.settings === null) {
      throw new Error('Touch navigation is disabled or destroyed.');
    }
    const host = 'frame' in this.reader ? this.reader.frame : this.reader.viewport;
    if (!surface.isConnected || surface.ownerDocument !== host.ownerDocument) {
      throw new TypeError('Touch surfaces must be attached elements in the host document.');
    }
    const binding = new TouchBinding(
      surface.ownerDocument,
      this.settings,
      () => this.geometry(),
      (direction) => this.turn(direction),
      () => this.snap(),
      surface,
      () =>
        !this.reader
          .getRenderedPages()
          .some((page) => page.document.getSelection()?.isCollapsed === false),
    );
    this.surfaces.add(binding);
    return () => {
      if (this.surfaces.delete(binding)) {
        binding.destroy();
      }
    };
  }

  /** Fixed RTL spreads turn horizontally; reflowable pages use their actual inline axis and sign. */
  private geometry(): TouchGeometry | null {
    const state = this.reader.flowState;
    if (state === null || state.flow !== 'paginated') {
      return null;
    }
    const fixed = 'fixedLayout' in this.reader && this.reader.fixedLayout !== null;
    return {
      axis: fixed ? 'horizontal' : state.axis,
      reverse: fixed ? state.direction === 'rtl' : state.reverse,
      key: JSON.stringify(state),
    };
  }

  /** Coalesce contacts during asynchronous navigation instead of racing display intents. */
  private turn(direction: -1 | 1): void {
    if (this.busy || this.destroyed) {
      return;
    }
    this.busy = true;
    this.failure = null;
    const operation = direction === 1 ? this.reader.next() : this.reader.prev();
    this.pending = operation.finally(() => {
      this.busy = false;
    });
    void this.pending.catch((error: unknown) => {
      if (!this.destroyed) {
        this.failure = error;
      }
    });
  }

  /** Snap a finished native paginated scroll to the closest reachable spread. */
  snap(): void {
    if (this.destroyed || this.settings === null || !('pagination' in this.reader)) {
      return;
    }
    const state = this.reader.flowState;
    const pages = this.reader.pagination;
    const document = this.reader.getContents();
    if (state === null || pages === null || document === null) {
      return;
    }
    const offset = scrollOffset(document, state);
    const nearest = Math.min(
      lastOffset(state, pages),
      Math.round(offset / pages.advance) * pages.advance,
    );
    if (Math.abs(offset - nearest) > 0.5) {
      scrollToOffset(document, state, nearest);
    }
  }

  /** Await the accepted gesture; failed navigation rejects without unhandled background promises. */
  async whenIdle(): Promise<void> {
    await this.pending;
  }

  /** Remove all contact/scroll listeners and restore touch-action declarations; safe to repeat. */
  destroy(): void {
    this.destroyed = true;
    this.unsubscribe?.();
    for (const binding of this.bindings.values()) {
      binding.destroy();
    }
    this.bindings.clear();
    for (const binding of this.surfaces) {
      binding.destroy();
    }
    this.surfaces.clear();
  }
}
