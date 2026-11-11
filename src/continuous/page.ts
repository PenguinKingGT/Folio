/** Expand one passive chapter to its intrinsic block extent without exposing an internal scrollbar. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { IframeView } from '../render/iframe-view';
import { chapterMarkup } from '../render/load-chapter';
import { WritingLayout } from '../layout/writing';
import type { WritingState } from '../layout/writing';
import { applyScrolling } from '../layout/scrolling';
import { isFixed } from '../layout/fixed-model';
import { documentViewport, applyFixedDocument } from '../layout/fixed-document';
import { fixedGeometry } from '../layout/fixed-geometry';
import type { ContinuousOptions } from './options';
import type { ViewportSize } from './port';
import type { RenderedPage } from '../render/fixed-spread';
import { mediaQueries } from '../layout/media-queries';
import type { Themes } from '../themes/themes';

/** Page metrics are measured in outer scrollport CSS pixels. */
export interface ContinuousMetrics {
  readonly viewport: ViewportSize;
  readonly writing: WritingState;
  readonly extent: number;
  readonly scale: number;
}

/** A ready document owns its observers and its entire view lifetime. */
export class ContinuousPage {
  readonly cell: HTMLDivElement;
  readonly view: IframeView;
  private readonly writing: WritingLayout;
  private metrics: ContinuousMetrics | null = null;
  private observer: ResizeObserver | undefined;
  private controller: AbortController | undefined;
  private signature = '';
  private committed = false;

  /** Allocate in an off-flow staging area until load and measurement succeed. */
  constructor(
    private readonly book: Book,
    readonly section: Section,
    parent: HTMLElement,
    options: ContinuousOptions,
    private readonly changed: () => void,
    private readonly themes?: Themes,
  ) {
    this.cell = parent.ownerDocument.createElement('div');
    this.cell.style.cssText = 'position:absolute;left:0;top:0;overflow:hidden;visibility:hidden;';
    this.cell.setAttribute('data-folio-section', String(section.index));
    this.cell.setAttribute('aria-hidden', 'true');
    const following = Array.from(parent.children).find(
      (element) => Number(element.getAttribute('data-folio-section')) > section.index,
    );
    parent.insertBefore(this.cell, following ?? null);
    this.view = new IframeView(this.cell, { ...options, width: '100%', height: 1 });
    this.writing = new WritingLayout(options, book.publication.direction);
  }

  /** Load only passive local resources and expose the ready document after a stable layout. */
  async load(
    token: string,
    signal: AbortSignal,
    size: ViewportSize,
    hint?: WritingState,
  ): Promise<void> {
    this.cell.style.width = `${size.width}px`;
    this.cell.style.height = `${size.height}px`;
    const markup = await chapterMarkup(this.book, this.section, token, signal);
    await this.view.load(markup, token, signal);
    await this.themes?.apply(this.rendered().document, signal);
    signal.throwIfAborted();
    this.view.show();
    this.layout(size, hint);
    this.watch();
  }

  /** Return validated metrics only after the document has been measured. */
  get measured(): ContinuousMetrics {
    if (this.metrics === null) {
      throw new Error('Continuous page has not been laid out.');
    }
    return this.metrics;
  }

  /** Expand reflowable content, or retain the authored containing block of a fixed page. */
  layout(size: ViewportSize, hint?: WritingState): void {
    const document = this.view.document;
    if (document === null) {
      throw new Error('Continuous page has no loaded document.');
    }
    this.cell.style.width = `${size.width}px`;
    this.view.frame.style.width = `${size.width}px`;
    this.view.frame.style.height = `${size.height}px`;
    const writing = this.writing.apply(document, 'scrolled-doc');
    if (isFixed(this.book.publication, this.section)) {
      const viewport = documentViewport(document);
      const axis = hint?.axis ?? 'vertical';
      const reverse = hint?.reverse ?? false;
      const scale =
        axis === 'vertical' ? size.width / viewport.width : size.height / viewport.height;
      const width = viewport.width * scale;
      const height = viewport.height * scale;
      applyFixedDocument(
        this.view.frame,
        document,
        fixedGeometry(viewport, width, height, 'center', false),
      );
      this.metrics = {
        viewport: size,
        writing: { ...writing, axis, reverse },
        extent: axis === 'vertical' ? height : width,
        scale,
      };
    } else {
      applyScrolling(document, size.width, size.height, writing);
      if (document.defaultView?.getComputedStyle(document.body).display === 'block') {
        document.body.style.display = 'flow-root';
      }
      const extent = this.expand(document, writing);
      this.metrics = { writing, extent, scale: 1, viewport: size };
    }
    const { extent, writing: measured } = this.measured;
    if (this.committed) {
      this.cell.style.width = `${measured.axis === 'horizontal' ? extent : size.width}px`;
      this.cell.style.height = `${measured.axis === 'vertical' ? extent : size.height}px`;
    }
    this.signature = this.currentSignature();
  }

  /** Position retained cells without reparenting an iframe and resetting its browsing context. */
  place(start: number, writing: WritingState, size: ViewportSize): void {
    this.committed = true;
    const horizontal = writing.axis === 'horizontal';
    this.cell.style.width = `${horizontal ? this.measured.extent : size.width}px`;
    this.cell.style.height = `${horizontal ? size.height : this.measured.extent}px`;
    this.cell.style.top = horizontal ? '0' : `${start}px`;
    this.cell.style.left = horizontal ? `${start}px` : '0';
    if (horizontal && writing.reverse) {
      this.cell.style.left = 'auto';
    }
    this.cell.style.right = horizontal && writing.reverse ? `${start}px` : 'auto';
    this.cell.style.visibility = '';
    this.cell.removeAttribute('aria-hidden');
  }

  /** Bound viewport-dependent CSS feedback rather than spinning or silently clipping a growing document. */
  private expand(document: Document, writing: WritingState): number {
    let extent = this.contentExtent(document, writing);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      this.view.frame.style[writing.axis === 'vertical' ? 'height' : 'width'] = `${extent}px`;
      const next = this.contentExtent(document, writing);
      if (next === extent) {
        return Math.ceil(Math.max(extent, next));
      }
      extent = next;
    }
    throw new RangeError('Continuous chapter viewport-dependent extent did not settle.');
  }

  /** A flow root contains normal paragraph margins and floats without forcing a viewport-sized blank gap. */
  private contentExtent(document: Document, writing: WritingState): number {
    const body = document.body;
    const bounds = body.getBoundingClientRect();
    const extent = Math.max(
      1,
      Math.ceil(
        writing.axis === 'vertical'
          ? Math.max(bounds.height, body.scrollHeight)
          : Math.max(bounds.width, body.scrollWidth),
      ),
    );
    if (extent > 1_000_000) {
      throw new RangeError('Continuous chapter extent exceeds the supported limit.');
    }
    return extent;
  }

  /** Compare native geometry after events so self-induced iframe resizing cannot create an observer loop. */
  private currentSignature(): string {
    const body = this.view.document?.body;
    const bounds = body?.getBoundingClientRect();
    return `${bounds?.width}:${bounds?.height}:${body?.scrollWidth}:${body?.scrollHeight}`;
  }

  /** Detect native geometry or typography changes before they can overwrite a stable reading anchor. */
  dirty(): boolean {
    const document = this.view.document;
    return (
      document !== null &&
      this.metrics !== null &&
      (this.currentSignature() !== this.signature ||
        !this.writing.matches(document, this.metrics.writing))
    );
  }

  /** Watch only a ready document; caller scheduling always occurs in the host realm. */
  private watch(): void {
    const document = this.view.document;
    if (document === null) {
      return;
    }
    this.controller = new AbortController();
    const options = { signal: this.controller.signal };
    this.observer = new ResizeObserver(() => {
      if (this.dirty()) {
        this.changed();
      }
    });
    this.observer.observe(document.body);
    document.addEventListener('load', this.changed, { ...options, capture: true });
    document.addEventListener('error', this.changed, { ...options, capture: true });
    document.fonts.addEventListener('loadingdone', this.changed, options);
    document.fonts.addEventListener('loadingerror', this.changed, options);
    for (const query of mediaQueries(document)) {
      document.defaultView?.matchMedia(query).addEventListener('change', this.changed, options);
      this.cell.ownerDocument.defaultView
        ?.matchMedia(query)
        .addEventListener('change', this.changed, options);
    }
  }

  /** Provide the same native-page contract as the bounded reader. */
  rendered(): RenderedPage {
    const document = this.view.document;
    if (document === null) {
      throw new Error('Continuous page has no loaded document.');
    }
    return { section: this.section, frame: this.view.frame, document };
  }

  /** Release observers, listeners, iframe resources, and the cell; safe to repeat. */
  destroy(): void {
    this.observer?.disconnect();
    this.controller?.abort();
    this.view.destroy();
    this.cell.remove();
  }
}
