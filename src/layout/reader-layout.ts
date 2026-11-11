/** Compose page and scroll layouts without growing the renderer's public lifecycle facade. */
import { measureFrame } from './columns';
import { resolveFlow } from './flow';
import type { FlowMode, FlowOptions, FlowState, ReadingAxis, ReadingFlow } from './flow';
import { PaginationLayout } from './pagination-layout';
import type { PaginationOptions, PaginationState } from './pagination';
import { applyScrolling } from './scrolling';
import { WritingLayout } from './writing';
import type { WritingOptions } from './writing';

/** Own layout configuration and measurements, without retaining chapter documents. */
export class ReaderLayout {
  private readonly pages: PaginationLayout;
  private flow: ReadingFlow;
  private measured: FlowState | null = null;
  private viewport: { width: number; height: number } | null = null;
  private fixed = false;
  private readonly writing: WritingLayout;
  private requestedAxis: ReadingAxis | undefined;

  /** Resolve publication metadata and validate options before iframe allocation. */
  constructor(
    options: PaginationOptions & FlowOptions & WritingOptions = {},
    private readonly metadata?: string,
    direction = 'default',
  ) {
    this.pages = new PaginationLayout(options);
    this.flow = resolveFlow(options, metadata).flow;
    this.requestedAxis = options.axis;
    this.writing = new WritingLayout(options, direction);
  }

  /** Expose pagination only while that flow is active. */
  get pagination(): PaginationState | null {
    return !this.fixed && this.flow === 'paginated' ? this.pages.state : null;
  }

  /** Expose the latest measured scroll extent or page/spread extent. */
  get state(): FlowState | null {
    return this.measured;
  }

  /** Detect stale measurements before a resize-triggered native scroll can replace the saved anchor. */
  matchesFrame(frame: HTMLIFrameElement): boolean {
    return measureFrame(this.fixed ? (frame.parentElement ?? frame) : frame, (width, height) => {
      if (this.viewport?.width !== width || this.viewport.height !== height) {
        return false;
      }
      const document = frame.contentDocument;
      if (document && this.measured && !this.writing.matches(document, this.measured)) {
        return false;
      }
      if (this.measured === null || this.measured.flow === 'paginated') {
        return true;
      }
      const root = frame.contentDocument?.documentElement;
      const body = frame.contentDocument?.body;
      const length =
        this.measured.axis === 'horizontal'
          ? Math.max(root?.scrollWidth ?? 0, body?.scrollWidth ?? 0)
          : Math.max(root?.scrollHeight ?? 0, body?.scrollHeight ?? 0);
      return Math.max(this.measured.viewport, length) === this.measured.length;
    });
  }

  /** Fixed pages use one logical viewport, regardless of their authored dimensions. */
  useFixed(width: number, height: number, document: Document): void {
    this.fixed = true;
    this.viewport = { width, height };
    this.measured = Object.freeze({
      ...this.writing.apply(document, 'paginated'),
      flow: 'paginated',
      axis: 'horizontal',
      reverse: false,
      length: width,
      viewport: width,
    });
  }

  /** Save validated spread configuration before a document is present. */
  configure(options: PaginationOptions): void {
    this.pages.configure(options);
  }

  /** Change flow transactionally; explicit mode changes discard previous position metrics. */
  setFlow(flow: FlowMode, axis?: ReadingAxis, document?: Document | null): void {
    const candidate = resolveFlow({ flow, ...(axis === undefined ? {} : { axis }) }, this.metadata);
    if (document && !this.fixed) {
      this.writing.apply(document, candidate.flow, axis);
    }
    this.flow = candidate.flow;
    this.requestedAxis = axis;
    this.measured = null;
  }

  /** Apply the active mode, clearing incompatible column or scrolling CSS as needed. */
  apply(
    frame: HTMLIFrameElement,
    document: Document,
    options: PaginationOptions = {},
  ): PaginationState | null {
    this.fixed = false;
    const writing = this.writing.apply(document, this.flow, this.requestedAxis);
    if (this.flow === 'paginated') {
      const pages = this.pages.apply(frame, document, options, writing.axis, writing.reverse);
      this.viewport = { width: pages.width, height: pages.height };
      this.measured = Object.freeze({
        flow: this.flow,
        ...writing,
        length: pages.pageCount * pages.advance - pages.gap,
        viewport: writing.axis === 'horizontal' ? pages.width : pages.height,
      });
      return pages;
    }
    this.pages.configure(options);
    const extent = measureFrame(frame, (width, height) => {
      this.viewport = { width, height };
      return applyScrolling(document, width, height, writing);
    });
    this.measured = Object.freeze({ flow: this.flow, ...writing, ...extent });
    return null;
  }
}
