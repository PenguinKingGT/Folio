/** Coalesce native scroll and resize work in the host realm and cancel it on reader destruction. */
import type { ContinuousPort } from './port';

/** Deferred layout flags survive an in-flight display without polling a busy reader. */
export class ContinuousObserver {
  private readonly controller = new AbortController();
  private readonly resize: ResizeObserver;
  private readonly scheduler: Window | null;
  private pending: number | undefined;
  private layout = false;
  private dimensions = '';
  private destroyed = false;

  /** Observe the real scrollport rather than script-disabled chapter windows. */
  constructor(
    port: ContinuousPort,
    private readonly flush: (layout: boolean) => boolean,
  ) {
    this.scheduler = port.viewport.ownerDocument.defaultView;
    this.dimensions = `${port.viewport.clientWidth}:${port.viewport.clientHeight}`;
    port.viewport.addEventListener('scroll', () => this.schedule(false), {
      passive: true,
      signal: this.controller.signal,
    });
    this.resize = new ResizeObserver(() => {
      const width = port.viewport.clientWidth;
      const height = port.viewport.clientHeight;
      const key = `${width}:${height}`;
      if (width > 0 && height > 0 && key !== this.dimensions) {
        this.dimensions = key;
        this.schedule(true);
      }
    });
    this.resize.observe(port.surface);
  }

  /** Queue at most one host animation frame; inactive and busy readers can defer layout. */
  schedule(layout: boolean): void {
    if (this.destroyed) {
      return;
    }
    this.layout ||= layout;
    if (this.pending === undefined) {
      this.pending = this.scheduler?.requestAnimationFrame(() => {
        this.pending = undefined;
        const requested = this.layout;
        this.layout = false;
        if (!this.flush(requested)) {
          this.layout ||= requested;
        }
      });
    }
  }

  /** Wait for currently runnable native work; zero-size/busy layout is deferred until rescheduled. */
  async whenIdle(): Promise<void> {
    while (this.pending !== undefined) {
      await new Promise<void>((resolve) => {
        this.scheduler?.requestAnimationFrame(() => resolve());
      });
    }
  }

  /** Stop listeners, resize observation, and queued host callbacks; safe to repeat. */
  destroy(): void {
    this.destroyed = true;
    this.controller.abort();
    this.resize.disconnect();
    if (this.pending !== undefined) {
      this.scheduler?.cancelAnimationFrame(this.pending);
    }
    this.pending = undefined;
    this.layout = false;
  }
}
