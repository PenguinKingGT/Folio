/** Validate intrinsic viewport dimensions and compute gapless fixed-page placement. */
import type { PageSide } from './fixed-model';

/** Authored dimensions of a single fixed-layout XHTML content document. */
export interface FixedViewport {
  readonly width: number;
  readonly height: number;
}

/** Scaled page placement inside the reader viewport, in CSS pixels. */
export interface FixedGeometry extends FixedViewport {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
  readonly side: PageSide;
  readonly spread: boolean;
}

/** Require numeric positive viewport dimensions; device-width is unsuitable for fixed pages. */
export function parseViewport(content: string): FixedViewport {
  const values = new Map<string, string>();
  for (const part of content.split(/[,;]/)) {
    const match = /^\s*([\w-]+)\s*=\s*([^\s]+)\s*$/.exec(part);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      values.set(match[1].toLowerCase(), match[2]);
    }
  }
  const width = Number(values.get('width'));
  const height = Number(values.get('height'));
  const numeric = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
  if (
    !numeric.test(values.get('width') ?? '') ||
    !numeric.test(values.get('height') ?? '') ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new TypeError(
      'Fixed-layout XHTML requires a positive numeric width and height viewport.',
    );
  }
  return Object.freeze({ width, height });
}

/** Fit one page or one half of a spread without introducing a gutter between facing pages. */
export function fixedGeometry(
  viewport: FixedViewport,
  width: number,
  height: number,
  side: PageSide,
  spread: boolean,
  sharedScale?: number,
): FixedGeometry {
  if (!['left', 'right', 'center'].includes(side)) {
    throw new TypeError('Invalid fixed-page side.');
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Fixed layout requires a positive finite reader viewport.');
  }
  if (
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    throw new RangeError('Intrinsic viewport dimensions must be positive and finite.');
  }
  const paired = spread && side !== 'center';
  const slot = paired ? width / 2 : width;
  const scale = sharedScale ?? Math.min(slot / viewport.width, height / viewport.height);
  if (
    !Number.isFinite(scale) ||
    scale <= 0 ||
    scale > Math.min(slot / viewport.width, height / viewport.height)
  ) {
    throw new RangeError('Fixed-page scale must fit the available slot.');
  }
  let x = (width - viewport.width * scale) / 2;
  if (paired) {
    x = side === 'left' ? width / 2 - viewport.width * scale : width / 2;
  }
  return Object.freeze({
    ...viewport,
    scale,
    x,
    y: (height - viewport.height * scale) / 2,
    side,
    spread: paired,
  });
}
