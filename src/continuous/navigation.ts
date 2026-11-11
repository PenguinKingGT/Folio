/** Serialize continuous display intents while keeping shared chapter producers independently owned. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { resolveDisplayTarget } from '../render/target';
import type { DisplayTarget, ResolvedTarget } from '../render/target';
import type { VisibleLocation } from '../render/location-types';
import type { ContinuousOptions } from './options';
import type { ContinuousPort, ViewportSize } from './port';
import type { ContinuousWindow, PreparedWindow } from './window';
import { pagePosition, readingReference, restoreReference, scrollToPosition } from './position';
import { readyWindow } from './candidates';
import { ReadingAnchor } from './anchor';

/** Reader callbacks isolate DOM ownership from notification and host animation scheduling. */
export interface ContinuousCallbacks {
  snapshot(): VisibleLocation | null;
  measure(): VisibleLocation | null;
  notify(): void;
  completed(): void;
  failed(error: unknown): void;
  starting(): void;
}

/** A newer explicit or native display intent owns the next committed view window. */
export class ContinuousNavigation {
  private readonly anchor: ReadingAnchor;
  private controller: AbortController | undefined;
  private generation = 0;
  private pending: Promise<void> = Promise.resolve();
  private sizeKey = '';
  private committedCenter = -1;
  private rejectedAt: string | null = null;
  center = -1;
  loading = false;
  explicit = false;

  /** Expose an operation revision so host callers can wait through native retargeting. */
  get version(): number {
    return this.generation;
  }

  /** Bind a window manager without starting IO. */
  constructor(
    private readonly book: Book,
    private readonly port: ContinuousPort,
    private readonly window: ContinuousWindow,
    private readonly options: ContinuousOptions,
    private readonly callbacks: ContinuousCallbacks,
  ) {
    this.anchor = new ReadingAnchor(port, window, () =>
      window.all().some((page) => page.dirty()) ? callbacks.snapshot() : callbacks.measure(),
    );
  }

  /** Prevent stale geometry from replacing the logical anchor during host resizing. */
  stable(): boolean {
    const size = this.port.size();
    return this.sizeKey === `${size.width}:${size.height}`;
  }

  /** Record native movement only after dimensions have been reconciled. */
  observe(snapshot: VisibleLocation): void {
    if (this.stable()) {
      this.anchor.observe(snapshot);
    }
  }

  /** Cancel stale subscribers and stage the requested window; neighboring failures remain observable. */
  display(target: DisplayTarget | undefined, explicit: boolean): Promise<Section> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.loading = true;
    this.explicit = explicit;
    this.callbacks.starting();
    this.rejectedAt = null;
    const operation = this.focus(
      target,
      explicit,
      String(++this.generation),
      controller.signal,
    ).finally(() => {
      if (this.controller === controller) {
        this.loading = false;
        this.callbacks.completed();
      }
    });
    this.pending = operation.then(() => undefined);
    void this.pending.catch((error: unknown) => {
      if (this.controller === controller && !controller.signal.aborted) {
        this.center = this.committedCenter;
        this.rejectedAt = `${this.window.offsets.at(this.port.offset())?.index}:${this.port.offset()}`;
        this.callbacks.failed(error);
      }
    });
    return operation;
  }

  /** Native scrolls can retarget an uncommitted native request, while explicit display retains priority. */
  sync(): void {
    if (this.loading && this.explicit) {
      return;
    }
    const section = this.window.offsets.at(this.port.offset());
    if (`${section?.index}:${this.port.offset()}` === this.rejectedAt) {
      return;
    }
    if (section !== null && section.index !== this.center) {
      void this.display(section.index, false);
    }
  }

  /** Prepare first, then compensate for both new measurements and trimmed predecessor cells. */
  private async focus(
    target: DisplayTarget | undefined,
    explicit: boolean,
    token: string,
    signal: AbortSignal,
  ): Promise<Section> {
    const current = this.callbacks.snapshot()?.start.index;
    const resolved = await resolveDisplayTarget(
      this.book,
      current === undefined ? null : this.book.section(current),
      target,
      signal,
    );
    signal.throwIfAborted();
    this.center = resolved.section.index;
    const initial = this.port.size();
    const prepared = await this.window.prepare(
      resolved.section,
      token,
      signal,
      initial,
      this.options.preloadBefore ?? 1,
      this.options.preloadAfter ?? 1,
    );
    try {
      signal.throwIfAborted();
      return this.commitFocus(resolved, explicit, prepared, signal);
    } catch (error) {
      this.window.discard(prepared.pages);
      throw error;
    }
  }

  /** Commit a ready window and restore the requested position in one synchronous DOM transaction. */
  private commitFocus(
    resolved: ResolvedTarget,
    explicit: boolean,
    prepared: PreparedWindow,
    signal: AbortSignal,
  ): Section {
    const size = this.port.size();
    const key = `${size.width}:${size.height}`;
    const changed =
      key !== this.sizeKey ||
      prepared.pages.some(
        (page) =>
          page.dirty() ||
          page.measured.viewport.width !== size.width ||
          page.measured.viewport.height !== size.height,
      );
    const reference = this.anchor.capture(changed);
    const candidate = changed ? this.reflowCandidates(prepared, resolved.section, size) : prepared;
    const page = candidate.pages.find((entry) => entry.section === resolved.section);
    if (page === undefined) {
      throw new Error('Continuous target page failed preparation.');
    }
    this.window.install(candidate.pages, page.measured.writing, size);
    this.sizeKey = key;
    this.committedCenter = resolved.section.index;
    if (explicit) {
      scrollToPosition(
        this.port,
        this.window,
        this.window.offsets.start(page.section.index) + pagePosition(page, resolved),
      );
    } else {
      restoreReference(this.port, this.window, reference, changed);
    }
    this.anchor.remember(
      explicit ? readingReference(this.port, this.window, this.callbacks.measure()) : reference,
    );
    this.callbacks.notify();
    if (!signal.aborted && candidate.errors.length > 0) {
      this.callbacks.failed(
        new AggregateError(candidate.errors, 'Continuous neighbor preparation failed.'),
      );
    }
    return resolved.section;
  }

  /** Reflow currently visible/preloaded documents without recreating native iframes. */
  layout(): void {
    const pages = this.window.all();
    // Delayed asset notifications must not turn an unchanged end position into a line-start seek.
    if (this.stable() && pages.every((page) => !page.dirty())) {
      return;
    }
    const reference = this.anchor.capture(!this.stable() || pages.some((page) => page.dirty()));
    const center = pages.find((page) => page.section.index === reference?.index) ?? pages[0];
    if (center === undefined) {
      return;
    }
    const size = this.port.size();
    const candidate = this.reflowCandidates({ pages, errors: [] }, center.section, size);
    this.window.install(candidate.pages, center.measured.writing, size, true);
    this.sizeKey = `${size.width}:${size.height}`;
    restoreReference(this.port, this.window, reference, true);
    this.anchor.remember(reference);
    this.callbacks.notify();
    if (candidate.errors.length > 0) {
      this.callbacks.failed(
        new AggregateError(candidate.errors, 'Continuous layout contains incompatible chapters.'),
      );
    }
  }

  /** Re-measure the center before fitting fixed companions and checking the remaining block axes. */
  private reflowCandidates(
    prepared: PreparedWindow,
    section: Section,
    size: ViewportSize,
  ): PreparedWindow {
    const center = prepared.pages.find((page) => page.section === section);
    if (center === undefined) {
      throw new Error('Continuous target page is missing.');
    }
    center.layout(size, center.measured.writing);
    for (const page of prepared.pages) {
      if (page !== center) {
        page.layout(size, center.measured.writing);
      }
    }
    const selected = readyWindow(
      prepared.pages,
      prepared.pages.map((page) => page.section),
      section,
      center.measured.writing,
      prepared.errors.slice(),
    );
    this.window.discard(prepared.pages.filter((page) => !selected.pages.includes(page)));
    return selected;
  }

  /** Ignore superseded task rejections while awaiting the newest committed intent. */
  async whenIdle(): Promise<void> {
    let pending: Promise<void>;
    do {
      pending = this.pending;
      try {
        await pending;
      } catch (error) {
        if (pending === this.pending) {
          throw error;
        }
      }
    } while (pending !== this.pending);
  }

  /** Abort pending consumers; the window owns already prepared view cleanup. */
  destroy(): void {
    this.controller?.abort();
  }
}
