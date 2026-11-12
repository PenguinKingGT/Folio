/** Detect blocked child-document callbacks and observe scroll offsets from the trusted host when needed. */

/** A temporary inert event distinguishes callback suppression without enabling publisher scripts or inspecting user-agent strings. */
export function nativeScrollCallbacks(document: Document): boolean {
  let delivered = false;
  const listener = () => {
    delivered = true;
  };
  document.addEventListener('folio:scroll-capability', listener);
  try {
    document.dispatchEvent(new Event('folio:scroll-capability'));
  } finally {
    document.removeEventListener('folio:scroll-capability', listener);
  }
  return delivered;
}

type FrameScheduler = Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>;

/** Fallback reads two numeric offsets per host frame; expensive location/overlay work runs only after movement. */
export class NativeScrollMonitor {
  private pending: number | undefined;
  private x: number;
  private y: number;

  /** Keep scheduling outside script-disabled publication frames. */
  constructor(
    private target: Window | null,
    private readonly scheduler: FrameScheduler | null,
    private readonly changed: () => void,
  ) {
    this.x = target?.scrollX ?? 0;
    this.y = target?.scrollY ?? 0;
    this.arm();
  }

  /** Compare native offsets before requesting any structural geometry reads. */
  private arm(): void {
    if (this.target !== null && this.scheduler !== null) {
      this.pending = this.scheduler.requestAnimationFrame(() => {
        this.pending = undefined;
        const target = this.target;
        if (target === null) {
          return;
        }
        const x = target.scrollX;
        const y = target.scrollY;
        if (x !== this.x || y !== this.y) {
          this.x = x;
          this.y = y;
          this.changed();
        }
        this.arm();
      });
    }
  }

  /** Cancel the host frame and drop the native window before the view is removed or replaced. */
  destroy(): void {
    this.target = null;
    if (this.pending !== undefined) {
      this.scheduler?.cancelAnimationFrame(this.pending);
    }
    this.pending = undefined;
  }
}
