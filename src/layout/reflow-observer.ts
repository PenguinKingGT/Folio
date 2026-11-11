/** Coalesce geometry, asset, font, and media changes into cancellable reader relayout work. */
import { measureFrame } from './columns';
import { mediaQueries } from './media-queries';

/** Own browser observations for one currently displayed chapter. */
export class ReflowObserver {
  private controller: AbortController | undefined;
  private resize: ResizeObserver | undefined;
  private window: Window | null = null;
  private pending: number | undefined;
  private size = '';
  private dirty = false;

  /** Bind a reusable frame and a synchronous position-preserving layout operation. */
  constructor(
    private readonly frame: HTMLIFrameElement,
    private readonly reflow: () => void,
  ) {}

  /** Start observing a chapter; replacement invalidates queued callbacks. */
  watch(document: Document): void {
    this.detach();
    this.window = document.defaultView;
    const controller = new AbortController();
    this.controller = controller;
    const options = { signal: controller.signal };
    this.size = measureFrame(this.frame, (width, height) => `${width}:${height}`);
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.frame);
    this.watchEvents(document, options);
  }

  /** Asset events are captured because image loads do not bubble. */
  private watchEvents(document: Document, options: { signal: AbortSignal }): void {
    const schedule = () => this.schedule();
    document.addEventListener('load', schedule, { ...options, capture: true });
    document.addEventListener('error', schedule, { ...options, capture: true });
    document.addEventListener('loadedmetadata', schedule, { ...options, capture: true });
    document.fonts.addEventListener('loadingdone', schedule, options);
    document.fonts.addEventListener('loadingerror', schedule, options);
    this.window?.addEventListener('resize', () => this.measure(), options);
    this.frame.ownerDocument.defaultView?.addEventListener('orientationchange', schedule, options);
    for (const query of mediaQueries(document)) {
      this.window?.matchMedia(query).addEventListener('change', schedule, options);
      // Host callbacks remain available when a passive WebKit frame suppresses its own callbacks.
      this.frame.ownerDocument.defaultView
        ?.matchMedia(query)
        .addEventListener('change', schedule, options);
    }
  }

  /** Ignore hidden/zero-sized observations and avoid loops from unchanged frame geometry. */
  private measure(): void {
    const { width, height } = this.frame.getBoundingClientRect();
    const size = `${width}:${height}`;
    if (width > 0 && height > 0 && (size !== this.size || this.dirty)) {
      this.size = size;
      this.schedule();
    }
  }

  /** Run at most one reflow per animation frame, deferring zero-sized containers until measurable. */
  private schedule(): void {
    this.dirty = true;
    if (this.pending === undefined) {
      // Schedule in the host realm: passive WebKit frames can deny their own animation frames.
      this.pending = this.frame.ownerDocument.defaultView?.requestAnimationFrame(() => {
        this.pending = undefined;
        measureFrame(this.frame, (width, height) => {
          if (width > 0 && height > 0) {
            this.dirty = false;
            this.reflow();
          }
        });
      });
    }
  }

  /** Release observers, DOM listeners, and pending animation frames; safe to repeat. */
  detach(): void {
    this.controller?.abort();
    this.resize?.disconnect();
    if (this.pending !== undefined) {
      this.frame.ownerDocument.defaultView?.cancelAnimationFrame(this.pending);
    }
    this.pending = undefined;
    this.dirty = false;
    this.window = null;
  }
}
