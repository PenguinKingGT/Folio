/** Prepare bounded chapter windows off-flow and install only ready contiguous pages around the target. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import type { WritingState } from '../layout/writing';
import { ContinuousPage } from './page';
import { ChapterOffsets } from './offsets';
import { readyWindow } from './candidates';
import type { ContinuousOptions } from './options';
import type { ContinuousPort, ViewportSize } from './port';

/** Preparation may retain a usable center while reporting optional neighbor failures. */
export interface PreparedWindow {
  readonly pages: readonly ContinuousPage[];
  readonly errors: readonly unknown[];
}

/** Immutable request state shared by neighbor loading and viewport buffer expansion. */
interface Preparation {
  center: ContinuousPage;
  token: string;
  signal: AbortSignal;
  size: ViewportSize;
}

/** One store owns all ready native documents and virtual prefix/suffix spacers. */
export class ContinuousWindow {
  readonly offsets: ChapterOffsets;
  revision = 0;
  private pages = new Map<number, ContinuousPage>();
  private dimensions = '';

  /** Build spacers once; all asynchronous pages load outside the scroll flow. */
  constructor(
    private readonly book: Book,
    private readonly port: ContinuousPort,
    private readonly options: ContinuousOptions,
    private readonly changed: () => void,
  ) {
    this.offsets = new ChapterOffsets(book.spine.all());
  }

  /** Return ready pages in spine order, including preloaded pages outside the viewport. */
  all(): readonly ContinuousPage[] {
    return Array.from(this.pages.values());
  }
  /** Return an already measured page without triggering any IO. */
  get(index: number): ContinuousPage | null {
    return this.pages.get(index) ?? null;
  }

  /** Read and measure a target and its bounded neighbors, rejecting only when the target fails. */
  async prepare(
    section: Section,
    token: string,
    signal: AbortSignal,
    size: ViewportSize,
    before: number,
    after: number,
  ): Promise<PreparedWindow> {
    this.offsets.include(section);
    const center = await this.preparePage(section, token, signal, size);
    const writing = center.measured.writing;
    const wanted = this.offsets.window(section.index, before, after);
    const context: Preparation = { center, token, signal, size };
    const { ready, errors } = await this.neighbors(wanted, context);
    const prepared = readyWindow(ready, wanted, section, writing, errors);
    this.discard(ready.filter((page) => !prepared.pages.includes(page)));
    const pages = prepared.pages.slice();
    try {
      await this.fill(pages, context, 1, errors);
      await this.fill(pages, context, -1, errors);
      signal.throwIfAborted();
      if (
        pages.reduce((total, page) => total + page.measured.extent, 0) <
          (writing.axis === 'vertical' ? size.height : size.width) &&
        pages.length < this.offsets.all().length
      ) {
        errors.push(
          new RangeError(
            'Continuous viewport needs more simultaneously rendered chapters than maxViews permits.',
          ),
        );
      }
      return { pages, errors };
    } catch (error) {
      this.discard(pages);
      throw error;
    }
  }

  /** Collect independent neighbor outcomes while retaining safe cleanup on cancellation. */
  private async neighbors(
    wanted: readonly Section[],
    context: Preparation,
  ): Promise<{ ready: ContinuousPage[]; errors: unknown[] }> {
    const { center, token, signal, size } = context;
    const section = center.section;
    const writing = center.measured.writing;
    const results = await Promise.allSettled(
      wanted.map((item) =>
        item === section
          ? Promise.resolve(center)
          : this.preparePage(item, token, signal, size, writing),
      ),
    );
    const ready = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (signal.aborted) {
      this.discard(ready);
      signal.throwIfAborted();
    }
    const errors: unknown[] = [];
    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(result.reason);
      }
    }
    return { ready, errors };
  }

  /** Fill a viewport-sized buffer around short chapters, while respecting the hard view cap. */
  private async fill(
    pages: ContinuousPage[],
    context: Preparation,
    delta: 1 | -1,
    errors: unknown[],
  ): Promise<void> {
    const { token, signal, size, center: anchorPage } = context;
    const center = anchorPage.section;
    const writing = anchorPage.measured.writing;
    const viewport = writing.axis === 'vertical' ? size.height : size.width;
    let extent = pages
      .filter((page) => (page.section.index - center.index) * delta > 0)
      .reduce((total, page) => total + page.measured.extent, 0);
    while (extent < viewport && pages.length < (this.options.maxViews ?? 32)) {
      const edge = delta === 1 ? pages.at(-1) : pages[0];
      const section = edge === undefined ? null : this.offsets.adjacent(edge.section.index, delta);
      if (section === null) {
        return;
      }
      try {
        const page = await this.preparePage(section, token, signal, size, writing);
        if (signal.aborted) {
          this.discard([page]);
          signal.throwIfAborted();
        }
        if (
          page.measured.writing.axis !== writing.axis ||
          page.measured.writing.reverse !== writing.reverse
        ) {
          this.discard([page]);
          throw new TypeError('Continuous neighbors must share a block axis and progression.');
        }
        if (delta === 1) {
          pages.push(page);
        } else {
          pages.unshift(page);
        }
        extent += page.measured.extent;
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        errors.push(error);
        return;
      }
    }
  }

  /** Reuse ready documents and destroy every newly failed or cancelled staging view. */
  private async preparePage(
    section: Section,
    token: string,
    signal: AbortSignal,
    size: ViewportSize,
    hint?: WritingState,
  ): Promise<ContinuousPage> {
    signal.throwIfAborted();
    const existing = this.pages.get(section.index);
    if (existing !== undefined) {
      return existing;
    }
    const page = new ContinuousPage(
      this.book,
      section,
      this.port.stage,
      this.options,
      this.changed,
    );
    try {
      await page.load(`${token}-${section.index}`, signal, size, hint);
      return page;
    } catch (error) {
      page.destroy();
      throw error;
    }
  }

  /** Install ready pages and replace unloaded ranges with persistent size estimates. */
  install(
    pages: readonly ContinuousPage[],
    writing: WritingState,
    size: ViewportSize,
    reset = false,
  ): void {
    const dimensions = `${size.width}:${size.height}:${writing.axis}:${writing.reverse}`;
    const estimate = writing.axis === 'vertical' ? size.height : size.width;
    this.offsets.update(
      pages.map((page) => ({ index: page.section.index, extent: page.measured.extent })),
      estimate,
      reset || dimensions !== this.dimensions,
    );
    this.dimensions = dimensions;
    const kept = new Map(pages.map((page) => [page.section.index, page]));
    for (const [index, page] of this.pages) {
      if (!kept.has(index)) {
        page.destroy();
      }
    }
    this.pages = kept;
    this.port.configure(writing);
    this.port.stage.style.width =
      writing.axis === 'horizontal' ? `${this.offsets.total}px` : '100%';
    this.port.stage.style.height = writing.axis === 'vertical' ? `${this.offsets.total}px` : '100%';
    for (const page of pages) {
      page.place(this.offsets.start(page.section.index), writing, size);
    }
    this.revision += 1;
  }

  /** Dispose staged candidates without destroying a page committed by a newer operation. */
  discard(pages: readonly ContinuousPage[]): void {
    for (const page of pages) {
      if (this.pages.get(page.section.index) !== page) {
        page.destroy();
      }
    }
  }

  /** Release every ready view; pending preparations are cancelled by the reader's controller. */
  destroy(): void {
    for (const page of this.pages.values()) {
      page.destroy();
    }
    this.pages.clear();
  }
}
