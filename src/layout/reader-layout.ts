/** Compose page and scroll layouts without growing the renderer's public lifecycle facade. */
import { measureFrame } from './columns';
import { resolveFlow } from './flow';
import type { FlowMode, FlowOptions, FlowState, ReadingAxis, ReadingFlow } from './flow';
import { PaginationLayout } from './pagination-layout';
import type { PaginationOptions, PaginationState } from './pagination';
import { applyScrolling } from './scrolling';

/** Own layout configuration and measurements, without retaining chapter documents. */
export class ReaderLayout {
  private readonly pages: PaginationLayout;
  private settings: { flow: ReadingFlow; axis: ReadingAxis };
  private measured: FlowState | null = null;

  /** Resolve publication metadata and validate options before iframe allocation. */
  constructor(
    options: PaginationOptions & FlowOptions = {},
    private readonly metadata?: string,
  ) {
    this.pages = new PaginationLayout(options);
    this.settings = resolveFlow(options, metadata);
  }

  /** Expose pagination only while that flow is active. */
  get pagination(): PaginationState | null {
    return this.settings.flow === 'paginated' ? this.pages.state : null;
  }

  /** Expose the latest measured scroll extent or page/spread extent. */
  get state(): FlowState | null {
    return this.measured;
  }

  /** Save validated spread configuration before a document is present. */
  configure(options: PaginationOptions): void {
    this.pages.configure(options);
  }

  /** Change flow transactionally; explicit mode changes discard previous position metrics. */
  setFlow(flow: FlowMode, axis?: ReadingAxis): void {
    this.settings = resolveFlow({ flow, ...(axis === undefined ? {} : { axis }) }, this.metadata);
    this.measured = null;
  }

  /** Apply the active mode, clearing incompatible column or scrolling CSS as needed. */
  apply(
    frame: HTMLIFrameElement,
    document: Document,
    options: PaginationOptions = {},
  ): PaginationState | null {
    if (this.settings.flow === 'paginated') {
      const pages = this.pages.apply(frame, document, options);
      this.measured = Object.freeze({
        ...this.settings,
        length: pages.pageCount * pages.advance - pages.gap,
        viewport: pages.width,
      });
      return pages;
    }
    this.pages.configure(options);
    const extent = measureFrame(frame, (width, height) =>
      applyScrolling(document, width, height, this.settings.axis),
    );
    this.measured = Object.freeze({ ...this.settings, ...extent });
    return null;
  }
}
