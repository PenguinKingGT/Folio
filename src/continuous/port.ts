/** Own a real host scrollport and a stable positioning stage for asynchronous chapter preparation. */
import { createSurface } from '../render/surface';
import type { ContinuousOptions } from './options';
import type { WritingState } from '../layout/writing';
import type { FlowState } from '../layout/flow';

/** Measured outer viewport dimensions remain separate from expanded chapter iframe dimensions. */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** Stage documents off the scroll flow, then place ready cells along one logical reading axis. */
export class ContinuousPort {
  readonly surface: HTMLDivElement;
  readonly viewport: HTMLDivElement;
  readonly stage: HTMLDivElement;
  private writing: WritingState | null = null;

  /** Keep all DOM nodes reader-owned; host container styles remain untouched. */
  constructor(container: HTMLElement, options: ContinuousOptions) {
    this.surface = createSurface(container, options);
    const document = container.ownerDocument;
    this.viewport = document.createElement('div');
    this.stage = document.createElement('div');
    this.viewport.style.cssText =
      'width:100%;height:100%;overflow:auto;scrollbar-width:none;overflow-anchor:none;';
    this.stage.style.cssText = 'position:relative;min-width:100%;min-height:100%;';
    this.viewport.appendChild(this.stage);
    this.surface.appendChild(this.viewport);
  }

  /** Reject unreadable zero-sized hosts before chapter loading begins. */
  size(): ViewportSize {
    const width = this.viewport.clientWidth;
    const height = this.viewport.clientHeight;
    if (width <= 0 || height <= 0) {
      throw new RangeError('Continuous reading requires a measurable viewport.');
    }
    return { width, height };
  }

  /** Preserve DOM reading order while allowing leftward vertical-rl block progression. */
  configure(writing: WritingState): void {
    this.writing = writing;
    const horizontal = writing.axis === 'horizontal';
    this.viewport.style.direction = horizontal && writing.reverse ? 'rtl' : 'ltr';
    this.viewport.style.overflowX = horizontal ? 'auto' : 'hidden';
    this.viewport.style.overflowY = horizontal ? 'hidden' : 'auto';
  }

  /** Read positive logical progress even when native horizontal coordinates are negative. */
  offset(): number {
    const native =
      this.writing?.axis === 'horizontal' ? this.viewport.scrollLeft : this.viewport.scrollTop;
    return Math.max(0, this.writing?.reverse ? -native : native);
  }

  /** Apply compensation or navigation synchronously without author smooth-scroll interference. */
  scroll(offset: number): void {
    const native = this.writing?.reverse ? -offset : offset;
    this.viewport.scrollTo({
      left: this.writing?.axis === 'horizontal' ? native : 0,
      top: this.writing?.axis === 'horizontal' ? 0 : native,
      behavior: 'instant',
    });
  }

  /** Describe the currently loaded window rather than inventing an unmeasured whole-book extent. */
  state(length: number): FlowState | null {
    if (this.writing === null) {
      return null;
    }
    const size = this.size();
    return Object.freeze({
      ...this.writing,
      flow: 'scrolled-continuous',
      length,
      viewport: this.writing.axis === 'horizontal' ? size.width : size.height,
    });
  }

  /** Hide without removing measurable geometry needed by background preparation. */
  show(visible: boolean): void {
    this.surface.style.visibility = visible ? '' : 'hidden';
  }
  /** Remove the complete scrollport, including the staging area. */
  destroy(): void {
    this.surface.remove();
  }
}
