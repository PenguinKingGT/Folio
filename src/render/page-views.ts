/** Manage an owned reader surface, the active iframe, and a bounded fixed-layout companion. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { IframeView } from './iframe-view';
import type { ViewOptions } from './iframe-view';
import { FixedSpread } from './fixed-spread';
import type { FixedLayoutState, RenderedPage } from './fixed-spread';
import { chapterMarkup } from './load-chapter';
import { paginationOptions } from '../layout/pagination';
import type { PaginationOptions } from '../layout/pagination';
import { measureFrame } from '../layout/columns';
import { isFixed } from '../layout/fixed-model';
import { documentViewport } from '../layout/fixed-document';
import { createSurface } from './surface';
import type { Themes } from '../themes/themes';

/** One surface retains dimensions while individual fixed pages scale inside it. */
export class PageViews {
  readonly surface: HTMLDivElement;
  private readonly main: IframeView;
  private readonly fixed: FixedSpread;
  private section: Section | null = null;
  private visible = false;
  private settings: Required<PaginationOptions>;

  /** Validate via the iframe view and remove the temporary surface on construction failure. */
  constructor(
    private readonly book: Book,
    container: HTMLElement,
    options: ViewOptions & PaginationOptions,
    private readonly themes?: Themes,
  ) {
    this.settings = paginationOptions(options);
    this.surface = createSurface(container, options);
    try {
      this.main = new IframeView(this.surface, { ...options, width: '100%', height: '100%' });
      this.resetFrame();
      this.fixed = new FixedSpread(book, this.surface, options, themes);
    } catch (error) {
      this.surface.remove();
      throw error;
    }
  }

  /** Return the primary native surface for compatibility with host integrations. */
  get frame(): HTMLIFrameElement {
    return this.main.frame;
  }
  /** Return only a fully loaded active document. */
  get document(): Document | null {
    return this.section === null ? null : this.main.document;
  }
  /** Return fixed geometry, otherwise null for reflowable chapters. */
  get fixedLayout(): FixedLayoutState | null {
    return this.fixed.measured;
  }

  /** Load the active page and prepare at most one fixed-layout partner. */
  async load(section: Section, token: string, signal: AbortSignal): Promise<void> {
    const content = await chapterMarkup(this.book, section, token, signal);
    this.fixed.clear();
    this.resetFrame();
    this.section = null;
    const document = await this.main.load(content, token, signal);
    await this.themes?.apply(document, signal);
    if (isFixed(this.book.publication, section)) {
      documentViewport(document);
    }
    await this.fixed.prepare(section, token, signal);
    signal.throwIfAborted();
    this.section = section;
  }

  /** Preserve validated spread options across chapters and reflows. */
  configure(options: PaginationOptions): void {
    this.settings = paginationOptions({ ...this.settings, ...options });
  }

  /** Fit the currently prepared fixed documents using validated reader settings. */
  applyFixed(options: PaginationOptions = {}): FixedLayoutState | null {
    this.configure(options);
    const primary = this.primaryPage();
    return primary === null
      ? null
      : measureFrame(this.surface, (width, height) =>
          this.fixed.apply(primary, width, height, this.settings, this.visible),
        );
  }

  /** Return visible page documents in reading order, even while the reader is hidden. */
  pages(): readonly RenderedPage[] {
    const primary = this.primaryPage();
    return primary === null ? [] : this.fixed.pages(primary);
  }

  /** Include a hidden prepared companion when updating reader styles. */
  loadedPages(): readonly RenderedPage[] {
    const primary = this.primaryPage();
    return primary === null ? [] : this.fixed.loaded(primary);
  }

  /** Bind a loaded document to the last completed chapter load. */
  private primaryPage(): RenderedPage | null {
    const document = this.document;
    return document && this.section ? { document, section: this.section, frame: this.frame } : null;
  }

  /** Restore host-sized geometry before loading a new chapter document. */
  private resetFrame(): void {
    this.frame.style.position = '';
    this.frame.style.transform = '';
    this.frame.style.width = '100%';
    this.frame.style.height = '100%';
  }

  /** Reveal the active page and any currently participating companion. */
  show(): void {
    this.visible = true;
    this.main.show();
    this.fixed.show(true);
  }
  /** Hide all pages without discarding their prepared documents. */
  hide(): void {
    this.visible = false;
    this.main.hide();
    this.fixed.show(false);
  }
  /** Release every document and remove only the owned surface. */
  destroy(): void {
    this.fixed.clear();
    this.main.destroy();
    this.surface.remove();
  }
}
