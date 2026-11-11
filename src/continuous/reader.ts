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
import { Listeners } from './listeners';
import { scrollToPosition } from './position';
import { TouchNavigation } from '../touch/navigation';
import { Themes } from '../themes/themes';

/** Opening remains lazy; display commits requested content and reports optional preload failures separately. */
export class ContinuousReader {
  /** Reader-owned opt-in pagination gesture bindings. */
  readonly touch: TouchNavigation;
  /** Reader-owned default, named, and override styles. */
  readonly themes: Themes;
  private readonly port: ContinuousPort;
  private readonly window: ContinuousWindow;
  private readonly navigation: ContinuousNavigation;
  private readonly observer: ContinuousObserver;
  private readonly relocations = new Listeners<VisibleLocation>();
  private readonly errors = new Listeners<unknown>();
  private snapshot: VisibleLocation | null = null;
  private locationKey = '';
  private geometryKey = '';
  private current: Section | null = null;
  private failed: unknown = null;
  private active = false;
  private destroyed = false;

  /** Create a host scrollport without requesting any chapter until display(). */
  constructor(
    private readonly book: Book,
    target: HTMLElement | string,
    options: ContinuousOptions = {},
    private readonly onDestroy?: () => void,
  ) {
    const settings = continuousOptions(options);
    this.port = new ContinuousPort(mountTarget(target), settings);
    this.themes = new Themes(book, {
      documents: () => this.getLoadedPages().map((page) => page.document),
      layout: () => this.layout(),
    });
    const changed = () => this.observer.schedule(true);
    this.window = new ContinuousWindow(book, this.port, settings, changed, this.themes);
    this.navigation = new ContinuousNavigation(book, this.port, this.window, settings, {
      snapshot: () => this.snapshot,
      measure: () => this.currentLocation(),
      notify: () => {
        this.active = true;
        this.report();
      },
      completed: () => this.observer.schedule(false),
      failed: (error) => this.failure(error),
      starting: () => {
        this.failed = null;
      },
    });
    this.observer = new ContinuousObserver(this.port, (layout) => this.flush(layout));
    this.touch = new TouchNavigation(this, options.touch);
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
    return this.failed;
  }
  /** Return loaded/preloaded section identities, bounded by the configured view cap. */
  get loadedSections(): readonly Section[] {
    return this.window.all().map((page) => page.section);
  }

  /** Display chapter/href/fragment/CFI/percentage targets; a new request cancels old consumers. */
  async display(target?: DisplayTarget): Promise<Section> {
    this.assertActive();
    return this.navigation.display(target, true);
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
    return this.relocations.subscribe(listener);
  }
  /** Observe asynchronous preload/layout failures without relying on console messages. */
  onError(listener: (error: unknown) => void): () => void {
    this.assertActive();
    return this.errors.subscribe(listener);
  }

  /** Re-measure expanded documents and compensate with the last stable reading CFI. */
  layout(): void {
    this.assertActive();
    this.navigation.layout();
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
    if (this.failed !== null) {
      throw this.failed;
    }
  }

  /** Restore the native scroll intent before updating the retained view window. */
  private async turn(delta: 1 | -1): Promise<Section | null> {
    this.assertActive();
    if (!this.active) {
      return this.display();
    }
    await this.whenIdle();
    const state = this.flowState;
    if (state === null) {
      return null;
    }
    const before = this.port.offset();
    const position = Math.max(
      0,
      Math.min(Math.max(0, state.length - state.viewport), before + state.viewport * delta),
    );
    if (Math.abs(position - before) <= 1) {
      return null;
    }
    scrollToPosition(this.port, this.window, position);
    this.report();
    this.navigation.sync();
    await this.whenIdle();
    return this.currentSection;
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
      this.failure(error);
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
    const key = JSON.stringify(this.snapshot);
    if (key !== this.locationKey) {
      this.locationKey = key;
      this.relocations.emit(this.snapshot);
    }
  }

  /** Preserve errors as public state and typed subscriber notifications. */
  private failure(error: unknown): void {
    if (!this.destroyed) {
      this.failed = error;
      this.errors.emit(error);
    }
  }

  /** Cancel IO consumers and observers, then release all owned frames/surfaces and subscribers. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.themes.destroy();
    this.destroyed = true;
    this.touch.destroy();
    this.navigation.destroy();
    this.observer.destroy();
    this.window.destroy();
    this.port.destroy();
    this.relocations.clear();
    this.errors.clear();
    this.snapshot = null;
    this.current = null;
    this.failed = null;
    this.onDestroy?.();
  }

  /** Fail consistently after reader or book destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('ContinuousReader has been destroyed.');
    }
  }
}
