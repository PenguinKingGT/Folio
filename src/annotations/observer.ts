/** Schedule overlay geometry in the host realm and ignore mutations caused by the overlay itself. */

/** Observe viewport geometry/scroll and native iframe positioning without creating a redraw loop. */
export class AnnotationObserver {
  private readonly controller = new AbortController();
  private readonly resize: ResizeObserver;
  private readonly mutation: MutationObserver;
  private readonly scheduler: Window | null;
  private pending: number | undefined;
  private destroyed = false;

  /** Listen to host scrolling; reader relocation/layout hooks cover native chapter viewport changes. */
  constructor(
    surface: HTMLElement,
    layer: SVGSVGElement,
    private readonly refresh: () => void,
  ) {
    this.scheduler = surface.ownerDocument.defaultView;
    surface.addEventListener('scroll', () => this.schedule(), {
      capture: true,
      passive: true,
      signal: this.controller.signal,
    });
    this.resize = new ResizeObserver(() => this.schedule());
    this.resize.observe(surface);
    this.mutation = new MutationObserver((records) => {
      if (records.some((record) => record.target !== layer && !layer.contains(record.target))) {
        this.schedule();
      }
    });
    this.mutation.observe(surface, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'hidden'],
    });
  }

  /** Coalesce relocation, native scroll, and host mutation notifications into at most one frame. */
  schedule(): void {
    if (!this.destroyed && this.pending === undefined) {
      this.pending = this.scheduler?.requestAnimationFrame(() => {
        this.pending = undefined;
        this.refresh();
      });
    }
  }

  /** Cancel a redundant queued draw before a synchronous public update. */
  cancel(): void {
    if (this.pending !== undefined) {
      this.scheduler?.cancelAnimationFrame(this.pending);
    }
    this.pending = undefined;
  }

  /** Wait for currently runnable geometry work, including work scheduled by a relocation callback. */
  async whenIdle(): Promise<void> {
    while (this.pending !== undefined) {
      await new Promise<void>((resolve) => this.scheduler?.requestAnimationFrame(() => resolve()));
    }
  }

  /** Stop observation and queued callbacks before releasing the overlay. */
  destroy(): void {
    this.destroyed = true;
    this.controller.abort();
    this.resize.disconnect();
    this.mutation.disconnect();
    this.cancel();
  }
}
