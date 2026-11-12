/** Keep validated pagination settings separate from the latest measured chapter state. */
import { applyColumns, measureFrame } from './columns';
import { computePagination, paginationOptions } from './pagination';
import type { PaginationOptions, PaginationState } from './pagination';
import type { ReadingAxis } from './flow';
import type { ColumnMedia } from './column-media';

/** Reusable layout controller that never retains documents or browser subscriptions. */
export class PaginationLayout {
  private options: Required<PaginationOptions>;
  private measured: PaginationState | null = null;

  /** Validate initial spread and spacing settings before allocating a reader surface. */
  constructor(
    options: PaginationOptions,
    private readonly media: ColumnMedia,
  ) {
    this.options = paginationOptions(options);
  }

  /** Return the latest immutable geometry and page count, or null before layout. */
  get state(): PaginationState | null {
    return this.measured;
  }

  /** Configure a reader before its first document has loaded. */
  configure(options: PaginationOptions): void {
    this.options = paginationOptions({ ...this.options, ...options });
  }

  /** Apply changes transactionally and measure actual browser column overflow. */
  apply(
    frame: HTMLIFrameElement,
    document: Document,
    changes: PaginationOptions = {},
    axis: ReadingAxis = 'horizontal',
    reverse = false,
  ): PaginationState {
    const candidate = paginationOptions({ ...this.options, ...changes });
    const state = measureFrame(frame, (width, height) =>
      applyColumns(
        document,
        computePagination(width, height, candidate, axis),
        this.media,
        reverse,
      ),
    );
    this.options = candidate;
    this.measured = state;
    return state;
  }
}
