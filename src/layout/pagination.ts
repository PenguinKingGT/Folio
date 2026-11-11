/** Pure pagination geometry, independent of DOM measurement and rendering state. */

/** Select automatic, single-column, or forced double-column views. */
export interface PaginationOptions {
  spread?: 'auto' | 'none' | 'always';
  minSpreadWidth?: number;
  gap?: number;
}

/** Geometry of one visible page/spread, with an inter-column advance. */
export interface PaginationGeometry {
  readonly width: number;
  readonly height: number;
  readonly columnsPerView: 1 | 2;
  readonly columnWidth: number;
  readonly gap: number;
  readonly advance: number;
}

/** Measured chapter pagination, including blank final-spread padding. */
export interface PaginationState extends PaginationGeometry {
  readonly columns: number;
  readonly pageCount: number;
}

/** Apply defaults and validate user-controlled pagination settings before mutating a view. */
export function paginationOptions(options: PaginationOptions): Required<PaginationOptions> {
  const settings: Required<PaginationOptions> = {
    spread: 'auto',
    minSpreadWidth: 800,
    gap: 24,
    ...options,
  };
  if (!['auto', 'none', 'always'].includes(settings.spread)) {
    throw new TypeError('Invalid spread mode.');
  }
  if (
    !Number.isFinite(settings.minSpreadWidth) ||
    settings.minSpreadWidth <= 0 ||
    !Number.isFinite(settings.gap) ||
    settings.gap < 0
  ) {
    throw new RangeError('Pagination threshold must be positive and gap non-negative.');
  }
  return settings;
}

/** Compute column geometry; viewport dimensions must be measurable and positive. */
export function computePagination(
  width: number,
  height: number,
  options: PaginationOptions = {},
): PaginationGeometry {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Pagination requires positive finite viewport dimensions.');
  }
  const settings = paginationOptions(options);
  const spread =
    settings.spread === 'always' ||
    (settings.spread === 'auto' && width >= settings.minSpreadWidth);
  const columnsPerView = spread ? 2 : 1;
  const columnWidth = (width - (columnsPerView - 1) * settings.gap) / columnsPerView;
  if (columnWidth <= 0) {
    throw new RangeError('Column gap leaves no readable column width.');
  }
  return Object.freeze({
    width,
    height,
    columnsPerView,
    columnWidth,
    gap: settings.gap,
    advance: (columnWidth + settings.gap) * columnsPerView,
  });
}
