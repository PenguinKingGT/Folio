/** Public continuous reader with bounded native views and estimated whole-book scrolling. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import type { DisplayTarget } from '../render/target';
import type { VisibleLocation, RelocatedListener } from '../render/location-types';
import type { RenderedPage } from '../render/fixed-spread';
import type { FlowState } from '../layout/flow';
import { mountTarget } from '../render/mount';
import { ContinuousPort } from './port';
import { ContinuousWindow } from './window';
import { ContinuousNavigation } from './navigation';
import { ContinuousObserver } from './observer';
import { continuousOptions } from './options';
import type { ContinuousOptions } from './options';
import { continuousLocation, visiblePages } from './location';
import { ContinuousEvents } from './events';
import { turnContinuous } from './turn';
import { ReaderEvents } from '../events/reader';
import { TouchNavigation } from '../touch/navigation';
import { Themes } from '../themes/themes';
import { ContentInteractions } from '../interaction/interactions';
import { Annotations } from '../annotations/annotations';

/** Opening remains lazy; display commits requested content and reports optional preload failures separately. */
export class ContinuousReader extends ReaderEvents {
  /** Reader-owned opt-in pagination gesture bindings. */
  readonly touch: TouchNavigation;
  /** Reader-owned default, named, and override styles. */
  readonly themes: Themes;
  /** Reader-owned native selections, input events, and controlled links. */
  readonly interactions: ContentInteractions;
  /** Reader-owned CFI annotations rendered in a host overlay. */
  readonly annotations: Annotations;
  private readonly port: ContinuousPort;
  private readonly window: ContinuousWindow;
  private readonly navigation: ContinuousNavigation;
  private readonly observer: ContinuousObserver;
  private readonly events = new ContinuousEvents();
  private snapshot: VisibleLocation | null = null;
  private geometryKey = '';
  private current: Section | null = null;
  private active = false;
  private destroyed = false;

  /** Create a host scrollport without requesting any chapter until display(). */
  constructor(
    private readonly book: Book,
    target: HTMLElement | string,
    options: ContinuousOptions = {},
    private readonly onDestroy?: () => void,
  ) {
    super();
    const settings = continuousOptions(options);
    this.port = new ContinuousPort(mountTarget(target), settings);
    this.themes = new Themes(book, {
      documents: () => this.getLoadedPages().map((page) => page.document),
      layout: () => this.layout(),
    });
    const changed = () => this.observer.schedule(true);
    this.interactions = new ContentInteractions(book, this);
    this.window = new ContinuousWindow(
      book,
      this.port,
      settings,
      changed,
      this.themes,
      this.interactions,
    );
    this.navigation = new ContinuousNavigation(book, this.port, this.window, settings, {
      snapshot: () => this.snapshot,
      measure: () => this.currentLocation(),
      notify: () => {
        this.active = true;
        this.report();
      },
      completed: () => this.observer.schedule(false),
      failed: (error) => this.events.fail(error),
      starting: () => {
        this.events.lastError = null;
      },
    });
    this.observer = new ContinuousObserver(this.port, (layout) => this.flush(layout));
    this.touch = new TouchNavigation(this, options.touch);
    this.annotations = new Annotations(book, this, this.port.surface);
    this.connectEvents(this);
  }

  /** The real outer scroll element is exposed for host scroll and accessibility integration. */
  get viewport(): HTMLDivElement {
    return this.port.viewport;
  }
  /** Return the first visible chapter, retaining the last reported chapter during asynchronous loading. */
  get currentSection(): Section | null {
    return this.current;
  }
  /** Report logical whole-book estimates and the effective block progression. */
  get flowState(): FlowState | null {
    this.assertActive();
    return this.port.state(this.window.offsets.total);
  }
  /** Retain background failures until the next display/retry; whenIdle() also rejects them. */
  get lastError(): unknown {
    return this.events.lastError;
  }
  /** Return loaded/preloaded section identities, bounded by the configured view cap. */
  get loadedSections(): readonly Section[] {
    return this.window.all().map((page) => page.section);
  }

  /** Display chapter/href/fragment/CFI/percentage targets; a new request cancels old consumers. */
  async display(target?: DisplayTarget): Promise<Section> {
    this.assertActive();
    return this.displayEvent(() => this.navigation.display(target, true), false);
  }

  /** Measure actual clipped native content, returning null inside an unloaded virtual range. */
  currentLocation(): VisibleLocation | null {
    this.assertActive();
    return continuousLocation(this.book, this.port, this.window);
  }
  /** Expose only pages intersecting the current viewport. */
  getRenderedPages(): readonly RenderedPage[] {
    this.assertActive();
    return visiblePages(this.port, this.window).map((page) => page.rendered());
  }
  /** Expose ready/preloaded native documents for host extensions without forcing them all visible. */
  getLoadedPages(): readonly RenderedPage[] {
    this.assertActive();
    return this.window.all().map((page) => page.rendered());
  }
  /** Return the first visible document, or null before display/while loading a virtual range. */
  getContents(): Document | null {
    return this.getRenderedPages()[0]?.document ?? null;
  }

  /** Subscribe to changed reading snapshots; callbacks run synchronously and should not throw. */
  onRelocated(listener: RelocatedListener): () => void {
    this.assertActive();
    return this.events.relocations.subscribe(listener);
  }
  /** Observe asynchronous preload/layout failures without relying on console messages. */
  onError(listener: (error: unknown) => void): () => void {
    this.assertActive();
    return this.events.errors.subscribe(listener);
  }

  /** Re-measure expanded documents and compensate with the last stable reading CFI. */
  layout(): void {
    this.assertActive();
    this.navigation.layout();
    this.annotations.refresh();
  }
  /** Reveal ready content without changing scroll position or loading policy. */
  show(): void {
    this.assertActive();
    this.port.show(true);
  }
  /** Hide while keeping measurable geometry for pending content and resize work. */
  hide(): void {
    this.assertActive();
    this.port.show(false);
  }

  /** Move forward one viewport in logical reading order. */
  next(): Promise<Section | null> {
    return this.turn(1);
  }
  /** Move backward one viewport in logical reading order. */
  prev(): Promise<Section | null> {
    return this.turn(-1);
  }

  /** Resolve runnable display/observer work; background failures reject predictably. */
  async whenIdle(): Promise<void> {
    this.assertActive();
    let version: number;
    do {
      if (this.active) {
        this.report();
        this.navigation.sync();
      }
      version = this.navigation.version;
      await this.navigation.whenIdle();
      await this.observer.whenIdle();
    } while (version !== this.navigation.version || this.navigation.loading);
    this.report();
    if (this.events.lastError !== null) {
      throw this.events.lastError;
    }
  }

  /** Delegate logical movement while retaining ownership of the live navigation window. */
  private async turn(delta: 1 | -1): Promise<Section | null> {
    this.assertActive();
    return turnContinuous(this, this.navigation, this.port, this.window, this.active, delta, () =>
      this.report(),
    );
  }

  /** Keep resize work deferred while an explicit/native display is staging new documents. */
  private flush(layout: boolean): boolean {
    if (this.destroyed || !this.active) {
      return true;
    }
    if (
      layout &&
      (this.navigation.loading ||
        this.viewport.clientWidth === 0 ||
        this.viewport.clientHeight === 0)
    ) {
      this.navigation.sync();
      return false;
    }
    try {
      if (layout) {
        this.navigation.layout();
      }
      this.report();
      this.navigation.sync();
    } catch (error) {
      this.events.fail(error);
    }
    return true;
  }

  /** Avoid repeated range traversal when neither native position nor measured layout changed. */
  private report(): void {
    if (
      this.destroyed ||
      !this.active ||
      this.viewport.clientWidth === 0 ||
      this.viewport.clientHeight === 0
    ) {
      return;
    }
    if (!this.navigation.stable()) {
      this.observer.schedule(true);
      return;
    }
    if (this.window.all().some((page) => page.dirty())) {
      this.observer.schedule(true);
      return;
    }
    const geometry = `${this.port.offset()}:${this.window.revision}`;
    if (geometry === this.geometryKey) {
      return;
    }
    this.geometryKey = geometry;
    this.snapshot = this.currentLocation();
    if (this.snapshot === null) {
      return;
    }
    this.current = this.book.section(this.snapshot.start.index);
    this.navigation.observe(this.snapshot);
    this.events.report(this.snapshot);
  }

  /** Cancel IO consumers and observers, then release all owned frames/surfaces and subscribers. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.themes.destroy();
    this.interactions.destroy();
    this.annotations.destroy();
    this.destroyed = true;
    this.touch.destroy();
    this.navigation.destroy();
    this.observer.destroy();
    this.window.destroy();
    this.port.destroy();
    this.events.destroy();
    this.snapshot = null;
    this.current = null;
    this.onDestroy?.();
    this.destroyEvents();
  }

  /** Fail consistently after reader or book destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('ContinuousReader has been destroyed.');
    }
  }
}
