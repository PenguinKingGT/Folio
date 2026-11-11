/** Bind touch Pointer Events to one native chapter while preserving browser zoom and control interaction. */
import type { ReadingAxis } from '../layout/flow';
import type { TouchOptions } from './options';
import { Swipe } from './swipe';
import { touchEligible } from './eligibility';

/** Effective pagination geometry, including a revision key that invalidates in-flight gestures. */
export interface TouchGeometry {
  axis: ReadingAxis;
  reverse: boolean;
  key: string;
}

/** A document owns one gesture at a time; multiple pointers invalidate the entire contact sequence. */
export class TouchBinding {
  private readonly controller = new AbortController();
  private readonly pointers = new Set<number>();
  private swipe: Swipe | null = null;
  private key = '';
  private readonly previous: string;
  private readonly priority: string;
  private readonly surface: HTMLElement;
  private applied = '';

  /** Register listeners in the native document; pointer movement remains cancellable only after axis lock. */
  constructor(
    private readonly document: Document,
    private readonly settings: Required<TouchOptions>,
    private readonly geometry: () => TouchGeometry | null,
    private readonly turn: (direction: -1 | 1) => void,
    private readonly snap: () => void,
    target: Document | HTMLElement = document,
    private readonly eligible: () => boolean = () => true,
  ) {
    this.surface = 'documentElement' in target ? target.documentElement : target;
    this.previous = this.surface.style.touchAction;
    this.priority = this.surface.style.getPropertyPriority('touch-action');
    const options = { signal: this.controller.signal };
    target.addEventListener(
      'pointerdown',
      (event) => {
        if (this.pointer(event)) {
          this.down(event);
        }
      },
      options,
    );
    target.addEventListener(
      'pointermove',
      (event) => {
        if (this.pointer(event)) {
          this.move(event);
        }
      },
      {
        ...options,
        passive: false,
      },
    );
    target.addEventListener(
      'pointerup',
      (event) => {
        if (this.pointer(event)) {
          this.up(event);
        }
      },
      options,
    );
    target.addEventListener('pointercancel', () => this.cancel(), options);
    document.addEventListener('scrollend', snap, options);
    this.refresh();
  }

  /** Narrow using the listener's own realm rather than a host-global constructor assertion. */
  private pointer(event: Event): event is PointerEvent {
    const realm = this.document.defaultView;
    return realm !== null && event instanceof realm.PointerEvent;
  }

  /** Update owned touch-action declarations after flow, layout, or typography changes. */
  refresh(): void {
    this.cancel();
    const geometry = this.geometry();
    if (geometry === null) {
      this.applied = this.previous;
      this.surface.style.setProperty('touch-action', this.previous, this.priority);
      return;
    }
    this.applied = geometry.axis === 'vertical' ? 'pan-x pinch-zoom' : 'pan-y pinch-zoom';
    this.surface.style.setProperty('touch-action', this.applied, 'important');
  }

  /** Start only a single touch on eligible content; pen/mouse input keeps native behavior. */
  private down(event: PointerEvent): void {
    if (event.pointerType !== 'touch' || event.defaultPrevented) {
      return;
    }
    this.pointers.add(event.pointerId);
    const geometry = this.geometry();
    if (
      this.pointers.size !== 1 ||
      !event.isPrimary ||
      geometry === null ||
      !this.eligible() ||
      !touchEligible(this.document, event.target, geometry.axis)
    ) {
      this.swipe = null;
      return;
    }
    this.key = geometry.key;
    this.swipe = new Swipe(
      { x: event.clientX, y: event.clientY, time: event.timeStamp },
      geometry.axis,
      geometry.reverse,
      this.settings,
    );
  }

  /** Cancel browser scrolling only after the recognizer owns a dominant pagination gesture. */
  private move(event: PointerEvent): void {
    if (
      this.pointers.size === 1 &&
      this.pointers.has(event.pointerId) &&
      this.swipe !== null &&
      this.swipe.move({ x: event.clientX, y: event.clientY, time: event.timeStamp })
    ) {
      event.preventDefault();
    }
  }

  /** Reject stale geometry, newly selected text, and multi-touch before issuing one page turn. */
  private up(event: PointerEvent): void {
    const active = this.pointers.size === 1 && this.pointers.has(event.pointerId);
    this.pointers.delete(event.pointerId);
    const swipe = this.swipe;
    this.swipe = null;
    const geometry = this.geometry();
    if (
      !active ||
      swipe === null ||
      geometry?.key !== this.key ||
      !this.eligible() ||
      !touchEligible(this.document, event.target, geometry.axis)
    ) {
      return;
    }
    const direction = swipe.end({ x: event.clientX, y: event.clientY, time: event.timeStamp });
    if (direction !== 0) {
      this.turn(direction);
    } else {
      this.snap();
    }
  }

  /** Release contact state on cancellation, refresh, and disposal. */
  private cancel(): void {
    this.swipe = null;
    this.pointers.clear();
  }

  /** Restore only declarations still owned by this binding and remove every listener. */
  destroy(): void {
    this.controller.abort();
    this.cancel();
    const style = this.surface.style;
    if (
      style.touchAction === this.applied &&
      style.getPropertyPriority('touch-action') === 'important'
    ) {
      style.setProperty('touch-action', this.previous, this.priority);
    }
  }
}
