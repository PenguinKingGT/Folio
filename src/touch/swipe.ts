/** Classify one primary-axis swipe without conflating taps, cross-axis scrolling, or long presses. */
import type { TouchOptions } from './options';
import type { ReadingAxis } from '../layout/flow';

/** Pointer coordinates belong to the same native document throughout one gesture. */
export interface SwipePoint {
  readonly x: number;
  readonly y: number;
  readonly time: number;
}

/** Recognize intent using distance and dominance; reverse maps physical to logical reading order. */
export class Swipe {
  private cancelled = false;

  /** Capture effective geometry at pointer-down so a resize or mode change can invalidate it. */
  constructor(
    private readonly start: SwipePoint,
    private readonly axis: ReadingAxis,
    private readonly reverse: boolean,
    private readonly settings: Required<TouchOptions>,
  ) {}

  /** Lock only a dominant primary-axis movement; cross-axis intent permanently cancels this gesture. */
  move(point: SwipePoint): boolean {
    const primary = Math.abs(this.distance(point));
    const cross = Math.abs(
      this.axis === 'horizontal' ? point.y - this.start.y : point.x - this.start.x,
    );
    if (cross >= this.settings.minDistance / 2 && cross > primary) {
      this.cancelled = true;
    }
    return (
      !this.cancelled &&
      primary >= this.settings.minDistance / 2 &&
      primary >= cross * this.settings.axisRatio
    );
  }

  /** Return one logical page turn, or zero when movement does not meet the gesture contract. */
  end(point: SwipePoint): -1 | 0 | 1 {
    const duration = point.time - this.start.time;
    if (
      !this.move(point) ||
      Math.abs(this.distance(point)) < this.settings.minDistance ||
      duration < 0 ||
      duration > this.settings.maxDurationMs
    ) {
      return 0;
    }
    return this.distance(point) < 0 !== this.reverse ? 1 : -1;
  }

  /** Read signed physical movement along the effective pagination axis. */
  private distance(point: SwipePoint): number {
    return this.axis === 'horizontal' ? point.x - this.start.x : point.y - this.start.y;
  }
}
