/** Bound continuous-reader view windows and retain the shared passive-view/typography options. */
import type { ViewOptions } from '../render/iframe-view';
import type { WritingOptions } from '../layout/writing';
import { viewTimeout } from '../render/surface';
import { validateWritingOptions } from '../layout/writing';

/** Continuous readers preload a bounded number of linear neighbors on both sides. */
export interface ContinuousOptions extends ViewOptions, WritingOptions {
  preloadBefore?: number;
  preloadAfter?: number;
  maxViews?: number;
}

/** Both sides retain at least one neighbor so native scrolling can cross chapter boundaries. */
export function continuousOptions(
  options: ContinuousOptions,
): ContinuousOptions & { preloadBefore: number; preloadAfter: number } {
  const preloadBefore = options.preloadBefore ?? 1;
  const preloadAfter = options.preloadAfter ?? 1;
  const maxViews = options.maxViews ?? 32;
  for (const value of [preloadBefore, preloadAfter]) {
    if (!Number.isInteger(value) || value < 1 || value > 4) {
      throw new RangeError('Continuous preload counts must be integers from one through four.');
    }
  }
  if (
    !Number.isInteger(maxViews) ||
    maxViews < preloadBefore + preloadAfter + 1 ||
    maxViews > 128
  ) {
    throw new RangeError('Continuous maxViews must cover the preload window and not exceed 128.');
  }
  viewTimeout(options.loadTimeoutMs);
  validateWritingOptions(options);
  return { ...options, preloadBefore, preloadAfter, maxViews };
}
