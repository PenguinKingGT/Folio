/** Basic reader facade: mount passive chapter documents and control their lifecycle. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { PageViews } from './page-views';
import type { ViewOptions } from './iframe-view';
import { ReaderLayout } from '../layout/reader-layout';
import type { PaginationOptions, PaginationState } from '../layout/pagination';
import type { FlowMode, FlowOptions, FlowState, ReadingAxis } from '../layout/flow';
import { resolveDisplayTarget } from './target';
import type { DisplayTarget } from './target';
import { turnPage } from './turn';
import { readLocation } from './location';
import { RenditionObservations } from './observations';
import { disposeAll } from '../async/lifecycle';
import type { RelocatedListener, VisibleLocation } from './location-types';
import { Cfi } from '../cfi/cfi';
import { mountTarget } from './mount';
import type { FixedLayoutState, RenderedPage } from './fixed-spread';
import type { WritingOptions } from '../layout/writing';
import { TouchNavigation } from '../touch/navigation';
import { touchOptions } from '../touch/options';
import type { TouchSettings } from '../touch/options';
import { Themes } from '../themes/themes';
import { RenditionAnchor } from './reading-anchor';
import { ContentInteractions } from '../interaction/interactions';
import { Annotations } from '../annotations/annotations';
import { ReaderEvents } from '../events/reader';
import { layoutPages } from '../layout/page-layout';

/** Initial renderer options; layout-specific behavior is added by subsequent features. */
export type RenditionOptions = ViewOptions &
  PaginationOptions &
  FlowOptions &
  WritingOptions &
  TouchSettings;

/** Display a book in one reusable, script-disabled iframe surface. */
export class Rendition extends ReaderEvents {
  /** Reader-owned opt-in pagination gesture bindings. */
  readonly touch: TouchNavigation;
  private readonly view: PageViews;
  private readonly layoutController: ReaderLayout;
  private readonly observations: RenditionObservations;
  /** Reader-owned default, named, and override styles. */
  readonly themes: Themes;
  /** Reader-owned selection snapshots, native input forwarding, and controlled links. */
  readonly interactions: ContentInteractions;
  /** Reader-owned CFI annotations rendered in a host overlay. */
  readonly annotations: Annotations;
  private readonly readingAnchor: RenditionAnchor;
  private generation = 0;
  private controller: AbortController | undefined;
  private current: Section | null = null;
  private visible = true;
  private destroyed = false;

  /** Attach to an existing container without loading a chapter until display(). */
  constructor(
    private readonly book: Book,
    target: HTMLElement | string,
    options: RenditionOptions = {},
    private readonly onDestroy?: () => void,
  ) {
    super();
    touchOptions(options.touch);
    this.layoutController = new ReaderLayout(
      options,
      book.publication.rendition.flow,
      book.publication.direction,
    );
    this.themes = new Themes(book, {
      documents: () => this.view.loadedPages().map((page) => page.document),
      layout: () => {
        this.layout();
      },
    });
    this.interactions = new ContentInteractions(book, this);
    this.view = new PageViews(book, mountTarget(target), options, this.themes, this.interactions);
    this.observations = new RenditionObservations(
      this.frame,
      this.view.surface,
      () => (this.layoutController.matchesFrame(this.frame) ? this.currentLocation() : null),
      () => {
        this.layout();
      },
      () => this.annotations.refresh(),
    );
    this.readingAnchor = new RenditionAnchor(this, this.observations.relocations);
    this.touch = new TouchNavigation(this, options.touch);
    this.annotations = new Annotations(book, this, this.view.surface);
    this.connectEvents(this);
  }

  /** The owned iframe is exposed for host integration; scripts remain disabled. */
  get frame(): HTMLIFrameElement {
    return this.view.frame;
  }

  /** Return the last successfully displayed chapter. */
  get currentSection(): Section | null {
    return this.current;
  }

  /** Load, sanitize, resolve assets, and display one chapter; a newer display cancels the old wait. */
  async display(target?: DisplayTarget): Promise<Section> {
    this.assertActive();
    return this.displayEvent(() => this.displayChapter(target));
  }

  /** Stage and commit one display intent before publishing its completion. */
  private async displayChapter(target?: DisplayTarget): Promise<Section> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const token = String(++this.generation);
    const resolved = await resolveDisplayTarget(this.book, this.current, target, controller.signal);
    controller.signal.throwIfAborted();
    const section = resolved.section;
    if (section === this.current && this.view.document !== null) {
      this.readingAnchor.seek(resolved);
      controller.signal.throwIfAborted();
      return section;
    }
    this.observations.detach();
    try {
      await this.view.load(section, token, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        this.observations.watch(this.view.document);
      }
      throw error;
    }
    controller.signal.throwIfAborted();
    this.current = section;
    this.readingAnchor.cfi = null;
    if (this.visible) {
      this.view.show();
    }
    this.layout();
    this.readingAnchor.seek(resolved);
    this.observations.watch(this.view.document);
    controller.signal.throwIfAborted();
    return section;
  }

  /** Move forward one viewport or to the next linear chapter; book end returns null. */
  async next(): Promise<Section | null> {
    this.assertActive();
    const result = await turnPage(this, this.book.spine, 'next');
    this.observations.relocations.report();
    return result;
  }

  /** Move backward one viewport or to the previous chapter's final viewport. */
  async prev(): Promise<Section | null> {
    this.assertActive();
    const result = await turnPage(this, this.book.spine, 'previous');
    this.observations.relocations.report();
    return result;
  }

  /** Measure visible CFIs, displayed viewport, and linear publication boundaries; unopened readers return null. */
  currentLocation(): VisibleLocation | null {
    this.assertActive();
    return readLocation(this.book, this);
  }

  /** Subscribe to changed reading positions; callbacks run synchronously and return an unsubscribe handle. */
  onRelocated(listener: RelocatedListener): () => void {
    this.assertActive();
    return this.observations.relocations.subscribe(listener);
  }

  /** Return measured column geometry and visible page/spread count. */
  get pagination(): PaginationState | null {
    return this.layoutController.pagination;
  }

  /** Return scaled fixed-page geometry, or null for reflowable content. */
  get fixedLayout(): FixedLayoutState | null {
    return this.view.fixedLayout;
  }

  /** Return actually displayed documents in spine order, including a facing fixed page. */
  getRenderedPages(): readonly RenderedPage[] {
    this.assertActive();
    return this.view.pages();
  }

  /** Reflow current contents while retaining the last reported reading CFI; no document returns null. */
  layout(options: PaginationOptions = {}): PaginationState | null {
    this.assertActive();
    const document = this.view.document;
    if (document === null) {
      this.layoutController.configure(options);
      this.view.configure(options);
      return null;
    }
    const anchor = this.readingAnchor.cfi;
    const result = layoutPages(this.layoutController, this.view, document, options);
    if (this.fixedLayout === null && anchor !== null && this.current !== null) {
      // Keep the logical anchor across repeated reflows instead of drifting to each new page start.
      this.readingAnchor.seek(
        { section: this.current, cfi: new Cfi(anchor), fragment: null },
        true,
      );
    } else {
      this.observations.relocations.report();
    }
    this.annotations.refresh();
    return result;
  }

  /** Return the active chapter's logical scroll extent after layout. */
  get flowState(): FlowState | null {
    return this.layoutController.state;
  }

  /** Switch reading modes and reflow current content; unopened readers retain configuration. */
  flow(mode: FlowMode, axis?: ReadingAxis): FlowState | null {
    this.assertActive();
    this.layoutController.setFlow(mode, axis, this.view.document);
    const document = this.view.document;
    if (document !== null) {
      layoutPages(this.layoutController, this.view, document);
    }
    this.view.document?.defaultView?.scrollTo(0, 0);
    this.observations.relocations.report();
    this.touch.refresh();
    this.annotations.refresh();
    return this.flowState;
  }

  /** Return native chapter contents, or null before the first successful display. */
  getContents(): Document | null {
    this.assertActive();
    return this.view.document;
  }

  /** Reveal current and future displayed content. */
  show(): void {
    this.assertActive();
    this.visible = true;
    if (this.current !== null) {
      this.view.show();
    }
    this.annotations.refresh();
  }

  /** Hide current content and keep later display operations hidden until show(). */
  hide(): void {
    this.assertActive();
    this.visible = false;
    this.view.hide();
    this.annotations.refresh();
  }

  /** Cancel display work and detach the view; book-owned resources remain reusable. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.controller?.abort();
    this.current = null;
    disposeAll([
      () => this.touch.destroy(),
      () => this.interactions.destroy(),
      () => this.annotations.destroy(),
      () => this.themes.destroy(),
      () => this.observations.destroy(),
      () => this.view.destroy(),
      () => this.onDestroy?.(),
      () => this.destroyEvents(),
    ]);
  }

  /** Fail consistently after renderer destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Rendition has been destroyed.');
    }
  }
}
