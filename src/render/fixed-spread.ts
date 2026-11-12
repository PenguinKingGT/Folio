/** Own one bounded companion view and apply fixed-page geometry to actual facing documents. */
import { disposeAll, errorAfterCleanup } from '../async/lifecycle';
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import type { PaginationOptions } from '../layout/pagination';
import { fixedGeometry } from '../layout/fixed-geometry';
import type { FixedGeometry } from '../layout/fixed-geometry';
import { isFixed, pageSides, renditionValue, spreadPartner } from '../layout/fixed-model';
import { applyFixedDocument, documentViewport } from '../layout/fixed-document';
import type { IframeView } from './iframe-view';
import { createView, destroyView } from './view-factory';
import { loadViewContent } from './view-content';
import type { ViewOptions } from './iframe-view';
import { chapterMarkup } from './load-chapter';
import type { Themes } from '../themes/themes';
import type { ContentInteractions } from '../interaction/interactions';

/** A rendered native document bound to its spine identity. */
export interface RenderedPage {
  readonly section: Section;
  readonly frame: HTMLIFrameElement;
  readonly document: Document;
}

/** Fixed layout measures one page per spine item and an optional facing companion. */
export interface FixedLayoutState {
  readonly width: number;
  readonly height: number;
  readonly primary: FixedGeometry;
  readonly companion: FixedGeometry | null;
}

/** Honor explicit reader settings before publication spread preferences. */
function enabled(
  book: Book,
  section: Section,
  options: Required<PaginationOptions>,
  width: number,
  height: number,
): boolean {
  if (options.spread !== 'auto') {
    return options.spread === 'always';
  }
  const preference = renditionValue(book.publication, section, 'spread', 'auto');
  if (preference === 'both') {
    return true;
  }
  if (preference === 'none') {
    return false;
  }
  if (preference === 'landscape') {
    return width > height;
  }
  if (preference === 'portrait') {
    return height > width;
  }
  return width >= options.minSpreadWidth;
}

/** Prepare a potential facing page eagerly so resize/spread changes remain synchronous. */
export class FixedSpread {
  private companion: IframeView | null = null;
  private partner: Section | null = null;
  private state: FixedLayoutState | null = null;
  private releaseInteractions: (() => void) | undefined;

  /** Bind resource ownership and a private positioned viewport. */
  constructor(
    private readonly book: Book,
    private readonly surface: HTMLElement,
    private readonly options: ViewOptions,
    private readonly themes?: Themes,
    private readonly interactions?: ContentInteractions,
  ) {}

  /** Expose immutable measurements only after a fixed page has been laid out. */
  get measured(): FixedLayoutState | null {
    return this.state;
  }

  /** Load at most one potential partner, including in single-page mode for later resizing. */
  async prepare(section: Section, token: string, signal: AbortSignal): Promise<void> {
    this.clear();
    const partner = spreadPartner(this.book.publication, this.book.spine.all(), section);
    if (partner === null) {
      return;
    }
    const content = await chapterMarkup(this.book, partner, `${token}-companion`, signal);
    const view = createView(this.surface, this.options);
    this.companion = view;
    try {
      const loaded = await loadViewContent({
        book: this.book,
        section: partner,
        view,
        content,
        token: `${token}-companion`,
        signal,
        themes: this.themes,
        interactions: this.interactions,
      });
      this.releaseInteractions = loaded.release;
      const document = loaded.document;
      signal.throwIfAborted();
      documentViewport(document);
      this.partner = partner;
    } catch (error) {
      throw errorAfterCleanup(error, () => {
        if (this.companion === view) {
          this.clear();
        }
      });
    }
  }

  /** Fit both pages using one scale and a common spine, without a synthetic gutter. */
  apply(
    primary: RenderedPage,
    width: number,
    height: number,
    options: Required<PaginationOptions>,
    visible: boolean,
  ): FixedLayoutState | null {
    if (!isFixed(this.book.publication, primary.section)) {
      return null;
    }
    const viewport = documentViewport(primary.document);
    const sides = pageSides(this.book.publication, this.book.spine.all());
    const side = sides.get(primary.section.index) ?? 'center';
    const spread = side !== 'center' && enabled(this.book, primary.section, options, width, height);
    const companion = this.partnerPage();
    const paired =
      spread && companion !== null && enabled(this.book, companion.section, options, width, height);
    const other = paired ? documentViewport(companion.document) : null;
    const scale = Math.min(
      width / (spread ? 2 : 1) / Math.max(viewport.width, other?.width ?? 0),
      height / Math.max(viewport.height, other?.height ?? 0),
    );
    const geometry = fixedGeometry(viewport, width, height, side, spread, scale);
    const otherGeometry =
      other === null
        ? null
        : fixedGeometry(other, width, height, side === 'left' ? 'right' : 'left', true, scale);
    applyFixedDocument(primary.frame, primary.document, geometry);
    if (companion !== null && otherGeometry !== null) {
      applyFixedDocument(companion.frame, companion.document, otherGeometry);
    }
    this.state = Object.freeze({ width, height, primary: geometry, companion: otherGeometry });
    this.show(visible);
    return this.state;
  }

  /** Return a companion only when its document finished loading. */
  private partnerPage(): RenderedPage | null {
    const document = this.companion?.document;
    return document && this.partner && this.companion
      ? { section: this.partner, document, frame: this.companion.frame }
      : null;
  }

  /** Expose only documents actually occupying visible slots, in spine reading order. */
  pages(primary: RenderedPage): readonly RenderedPage[] {
    const companion = this.partnerPage();
    if (this.state?.companion && companion) {
      return primary.section.index < companion.section.index
        ? [primary, companion]
        : [companion, primary];
    }
    return [primary];
  }

  /** Return all ready documents, including a companion hidden by single-page fitting. */
  loaded(primary: RenderedPage): readonly RenderedPage[] {
    const companion = this.partnerPage();
    return companion === null ? [primary] : [primary, companion];
  }

  /** Keep preloaded companions hidden until the chosen spread mode uses them. */
  show(visible: boolean): void {
    if (visible && this.state?.companion) {
      this.companion?.show();
    } else {
      this.companion?.hide();
    }
  }

  /** Release a previous companion before loading or destroying another chapter. */
  clear(): void {
    const release = this.releaseInteractions;
    const companion = this.companion;
    this.releaseInteractions = undefined;
    this.companion = null;
    this.partner = null;
    this.state = null;
    disposeAll([() => release?.(), () => destroyView(companion)]);
  }
}
