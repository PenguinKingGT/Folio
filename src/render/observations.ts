/** Own bounded reader location/reflow observation as one lifecycle independent of layout and document loading. */
import { Relocations } from './relocation';
import { ReflowObserver } from '../layout/reflow-observer';
import type { VisibleLocation } from './location-types';
import { disposeAll } from '../async/lifecycle';

/** Native observations are replaced together when a display intent commits or retains an older document. */
export class RenditionObservations {
  readonly relocations: Relocations;
  private readonly reflows: ReflowObserver;

  /** Keep animation scheduling in the host and read location only after layout is measurable. */
  constructor(
    frame: HTMLIFrameElement,
    surface: HTMLElement,
    read: () => VisibleLocation | null,
    layout: () => void,
  ) {
    this.relocations = new Relocations(read, frame.ownerDocument.defaultView);
    this.reflows = new ReflowObserver(frame, layout, surface);
  }

  /** Begin both observers only when a native document is actually available. */
  watch(document: Document | null): void {
    if (document !== null) {
      this.reflows.watch(document);
      this.relocations.watch(document);
    }
  }
  /** Stop old-document callbacks and scheduled animation work before replacement. */
  detach(): void {
    this.relocations.detach();
    this.reflows.detach();
  }
  /** Release every subscription even when an independent teardown phase fails. */
  destroy(): void {
    disposeAll([() => this.relocations.destroy(), () => this.reflows.detach()]);
  }
}
