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
import { Relocations } from './relocation';
import type { RelocatedListener, VisibleLocation } from './location-types';
import { ReflowObserver } from '../layout/reflow-observer';
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

/** Initial renderer options; layout-specific behavior is added by subsequent features. */
export type RenditionOptions = ViewOptions &
  PaginationOptions &
  FlowOptions &
  WritingOptions &
  TouchSettings;

/** Display a book in one reusable, script-disabled iframe surface. */
export class Rendition {
  /** Reader-owned opt-in pagination gesture bindings. */
  readonly touch: TouchNavigation;
  private readonly view: PageViews;
  private readonly layoutController: ReaderLayout;
  private readonly relocations: Relocations;
  private readonly reflows: ReflowObserver;
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
    this.relocations = new Relocations(
      () => (this.layoutController.matchesFrame(this.frame) ? this.currentLocation() : null),
      this.frame.ownerDocument.defaultView,
    );
    this.readingAnchor = new RenditionAnchor(this, this.relocations);
    this.reflows = new ReflowObserver(
      this.frame,
      () => {
        this.layout();
      },
      this.view.surface,
    );
    this.touch = new TouchNavigation(this, options.touch);
    this.annotations = new Annotations(book, this, this.view.surface);
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
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const token = String(++this.generation);
    const resolved = await resolveDisplayTarget(this.book, this.current, target, controller.signal);
    controller.signal.throwIfAborted();
    const section = resolved.section;
    if (section === this.current && this.view.document !== null) {
      this.readingAnchor.seek(resolved);
      return section;
    }
    this.relocations.detach();
    this.reflows.detach();
    try {
      await this.view.load(section, token, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        this.watchContents();
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
    this.watchContents();
    return section;
  }

  /** Observe completed content, including a retained document after a failed chapter read. */
  private watchContents(): void {
    const document = this.view.document;
    if (document !== null) {
      this.relocations.watch(document);
      this.reflows.watch(document);
    }
  }

  /** Move forward one viewport or to the next linear chapter; book end returns null. */
  async next(): Promise<Section | null> {
    this.assertActive();
    const result = await turnPage(this, this.book.spine, 'next');
    this.relocations.report();
    return result;
  }

  /** Move backward one viewport or to the previous chapter's final viewport. */
  async prev(): Promise<Section | null> {
    this.assertActive();
    const result = await turnPage(this, this.book.spine, 'previous');
    this.relocations.report();
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
    return this.relocations.subscribe(listener);
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

  /** Choose fixed-page fitting before the configured reflowable flow. */
  private applyLayout(document: Document, options: PaginationOptions = {}): PaginationState | null {
    this.layoutController.configure(options);
    const fixed = this.view.applyFixed(options);
    if (fixed !== null) {
      this.layoutController.useFixed(fixed.width, fixed.height, document);
      return null;
    }
    return this.layoutController.apply(this.frame, document, options);
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
    const result = this.applyLayout(document, options);
    if (this.fixedLayout === null && anchor !== null && this.current !== null) {
      // Keep the logical anchor across repeated reflows instead of drifting to each new page start.
      this.readingAnchor.seek(
        { section: this.current, cfi: new Cfi(anchor), fragment: null },
        true,
      );
    } else {
      this.relocations.report();
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
      this.applyLayout(document);
    }
    this.view.document?.defaultView?.scrollTo(0, 0);
    this.relocations.report();
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
    if (!this.destroyed) {
      this.controller?.abort();
      this.touch.destroy();
      this.interactions.destroy();
      this.annotations.destroy();
      this.themes.destroy();
      this.relocations.destroy();
      this.reflows.detach();
      this.view.destroy();
      this.current = null;
      this.destroyed = true;
      this.onDestroy?.();
    }
  }

  /** Fail consistently after renderer destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Rendition has been destroyed.');
    }
  }
}
