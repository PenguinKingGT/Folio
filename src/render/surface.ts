/** Create sized, reader-owned viewports without mutating host container styles. */
import type { ViewOptions } from './iframe-view';

/** Validate CSS lengths through the owning browser's style parser. */
export function setDimension(
  element: HTMLElement,
  property: 'width' | 'height',
  value: number | string,
): void {
  if (typeof value === 'number' && (!Number.isFinite(value) || value <= 0)) {
    throw new RangeError(`${property} must be a positive finite size.`);
  }
  const previous = element.style[property];
  element.style[property] = '';
  element.style[property] = typeof value === 'number' ? `${value}px` : value;
  if (element.style[property] === '') {
    element.style[property] = previous;
    throw new TypeError(`Invalid CSS ${property}.`);
  }
}

/** Allocate only after attachment, namespace, and dimension checks pass. */
export function createSurface(container: HTMLElement, options: ViewOptions): HTMLDivElement {
  if (!container.isConnected || container.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
    throw new TypeError('The reader container must be an attached HTML element.');
  }
  const surface = container.ownerDocument.createElement('div');
  surface.style.position = 'relative';
  surface.style.overflow = 'hidden';
  setDimension(surface, 'width', options.width ?? '100%');
  setDimension(surface, 'height', options.height ?? '100%');
  container.appendChild(surface);
  return surface;
}

/** Validate view timeouts before allocating any iframe or continuous-reader surface. */
export function viewTimeout(value = 15_000): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('loadTimeoutMs must be positive and finite.');
  }
  return value;
}
