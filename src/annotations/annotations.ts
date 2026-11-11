/** Reader-scoped annotation registrations and host overlay geometry without publication DOM wrappers. */
import type { Book } from '../book/book';
import type { RenderedPage } from '../render/fixed-spread';
import { Listeners } from '../events/listeners';
import { AnnotationStore } from './store';
import { AnnotationLayer } from './layer';
import { AnnotationObserver } from './observer';
import { annotationRange, annotationGeometry } from './geometry';
import type { DrawnAnnotation } from './geometry';
import type {
  Annotation,
  AnnotationType,
  AnnotationOptions,
  AnnotationUpdate,
  AnnotationHost,
  AnnotationClick,
} from './types';

/** Registrations persist through view reload/trim; the overlay owns no resource URLs or text nodes. */
export class Annotations {
  private readonly store: AnnotationStore;
  private readonly layer: AnnotationLayer;
  private readonly observer: AnnotationObserver;
  private readonly clicks = new Listeners<AnnotationClick>();
  private readonly errors = new Listeners<unknown>();
  private readonly unsubscribe: () => void;
  private visible = true;
  private destroyed = false;
  private failed: unknown = null;

  /** Create one host-owned overlay; callbacks remain outside passive frame execution contexts. */
  constructor(
    book: Book,
    private readonly host: AnnotationHost,
    private readonly surface: HTMLElement,
  ) {
    if (!surface.isConnected || surface.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      throw new TypeError('Annotations require an attached HTML surface.');
    }
    this.store = new AnnotationStore(book);
    this.layer = new AnnotationLayer(surface, (id, event) => this.clicked(id, event));
    this.observer = new AnnotationObserver(surface, this.layer.element, () => this.refresh());
    try {
      this.unsubscribe = host.onRelocated(() => this.refresh());
    } catch (error) {
      this.observer.destroy();
      this.layer.destroy();
      throw error;
    }
  }

  /** Expose the owned SVG for host styling and accessibility integration. */
  get element(): SVGSVGElement {
    return this.layer.element;
  }
  /** Report target/geometry failures without failing otherwise readable chapters. */
  get lastError(): unknown {
    return this.failed;
  }

  /** Validate currently rendered targets before changing the registration map. */
  add(type: AnnotationType, cfi: string, options: AnnotationOptions = {}): Annotation {
    this.assertActive();
    const annotation = this.store.create(type, cfi, options);
    this.validate(annotation);
    this.store.commit(annotation);
    this.refresh();
    return annotation;
  }
  /** Register a text-range highlight; interaction is opt-in to preserve native selection. */
  highlight(cfi: string, options: AnnotationOptions = {}): Annotation {
    return this.add('highlight', cfi, options);
  }
  /** Register a text-range underline following the native writing axis. */
  underline(cfi: string, options: AnnotationOptions = {}): Annotation {
    return this.add('underline', cfi, options);
  }
  /** Register a point/range-start badge; marks are interactive by default. */
  mark(cfi: string, options: AnnotationOptions = {}): Annotation {
    return this.add('mark', cfi, options);
  }

  /** Retain annotation ID/type while updating target, metadata, label, or appearance atomically. */
  update(id: string, patch: AnnotationUpdate): Annotation {
    this.assertActive();
    const annotation = this.store.change(id, patch);
    this.validate(annotation);
    this.store.commit(annotation);
    this.refresh();
    return annotation;
  }
  /** Remove one registration; repeated removal returns false. */
  remove(id: string): boolean {
    this.assertActive();
    const removed = this.store.remove(id);
    if (removed) {
      this.refresh();
    }
    return removed;
  }
  /** Return one immutable registration, or null when it has been removed. */
  get(id: string): Annotation | null {
    this.assertActive();
    return this.store.get(id);
  }
  /** Return immutable snapshots in registration order. */
  all(): readonly Annotation[] {
    this.assertActive();
    return this.store.all();
  }
  /** Clear registered targets and geometry without changing the current reading position. */
  clear(): void {
    this.assertActive();
    this.store.clear();
    this.refresh();
  }

  /** Show annotations independently of the reader's own visibility. */
  show(): void {
    this.assertActive();
    this.visible = true;
    this.refresh();
  }
  /** Hide geometry while retaining registrations and callbacks. */
  hide(): void {
    this.assertActive();
    this.visible = false;
    this.refresh();
  }
  /** Subscribe to interactive host-overlay activation; callbacks run synchronously and should not throw. */
  onClick(listener: (event: AnnotationClick) => void): () => void {
    this.assertActive();
    return this.clicks.subscribe(listener);
  }
  /** Observe deferred target resolution and bounded-geometry failures. */
  onError(listener: (error: unknown) => void): () => void {
    this.assertActive();
    return this.errors.subscribe(listener);
  }

  /** Recompute clipped native rectangles after custom host scrolling or content changes. */
  refresh(): void {
    if (this.destroyed) {
      return;
    }
    this.observer.cancel();
    this.failed = null;
    const width = this.surface.clientWidth;
    const height = this.surface.clientHeight;
    if (!this.visible || width <= 0 || height <= 0) {
      this.layer.show(false);
      return;
    }
    const pages = this.host
      .getRenderedPages()
      .filter(
        (page) => !page.frame.hidden && page.frame.clientWidth > 0 && page.frame.clientHeight > 0,
      );
    const { drawings, errors } = this.draw(pages);
    this.layer.render(drawings, width, height);
    this.layer.show(drawings.length > 0);
    if (errors.length > 0) {
      this.failed = new AggregateError(errors, 'Some annotations could not be rendered.');
      this.errors.emit(this.failed);
    }
  }

  /** Unloaded chapters validate when rendered; loaded target updates stay atomic. */
  private validate(annotation: Annotation): void {
    for (const page of this.host.getRenderedPages()) {
      if (page.section.index === annotation.sectionIndex) {
        annotationRange(page.document, annotation);
      }
    }
  }

  /** Keep invalid or oversized targets from suppressing every other annotation. */
  private draw(pages: readonly RenderedPage[]): { drawings: DrawnAnnotation[]; errors: unknown[] } {
    const drawings: DrawnAnnotation[] = [];
    const errors: unknown[] = [];
    const annotations = this.store.all();
    let fragments = 0;
    for (const page of pages) {
      for (const annotation of annotations) {
        if (annotation.sectionIndex !== page.section.index) {
          continue;
        }
        try {
          const drawn = annotationGeometry(page, annotation, this.surface);
          fragments += drawn.boxes.length;
          if (fragments > 8192) {
            errors.push(new RangeError('Too many rendered annotation fragments.'));
            return { drawings, errors };
          }
          if (drawn.boxes.length > 0) {
            drawings.push(drawn);
          }
        } catch (error) {
          errors.push(error);
        }
      }
    }
    return { drawings, errors };
  }

  /** Look up current metadata so updates never leave stale click payloads behind. */
  private clicked(id: string, event: MouseEvent | KeyboardEvent): void {
    const annotation = this.store.get(id);
    if (
      !this.destroyed &&
      this.visible &&
      this.layer.element.style.display !== 'none' &&
      annotation?.interactive === true
    ) {
      this.clicks.emit(Object.freeze({ annotation, event }));
    }
  }

  /** Settle queued draws and report optional rendering errors. */
  async whenIdle(): Promise<void> {
    this.assertActive();
    await this.observer.whenIdle();
    if (this.failed !== null) {
      throw this.failed;
    }
  }

  /** Release model data, callbacks, observers, and host SVG nodes; safe to repeat. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.unsubscribe();
    this.observer.destroy();
    this.layer.destroy();
    this.store.clear();
    this.clicks.clear();
    this.errors.clear();
    this.failed = null;
  }

  /** Reject registration and subscriptions after terminal cleanup. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Annotations have been destroyed.');
    }
  }
}
