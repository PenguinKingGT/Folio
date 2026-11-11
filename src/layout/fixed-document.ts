/** Apply scaled fixed-page geometry while preserving author content styles. */
import { parseViewport } from './fixed-geometry';
import type { FixedGeometry, FixedViewport } from './fixed-geometry';

/** Read the mandatory XHTML viewport declaration before mutating layout styles. */
export function documentViewport(document: Document): FixedViewport {
  const meta = Array.from(document.head.querySelectorAll('meta')).find(
    (element) => element.name.toLowerCase() === 'viewport',
  );
  return parseViewport(meta?.content ?? '');
}

/** Keep the original iframe viewport as the author containing block, then scale the whole frame. */
export function applyFixedDocument(
  frame: HTMLIFrameElement,
  document: Document,
  geometry: FixedGeometry,
): void {
  const root = document.documentElement;
  root.style.width = `${geometry.width}px`;
  root.style.height = `${geometry.height}px`;
  root.style.overflow = 'hidden';
  frame.style.position = 'absolute';
  frame.style.left = '0';
  frame.style.top = '0';
  frame.style.width = `${geometry.width}px`;
  frame.style.height = `${geometry.height}px`;
  frame.style.transformOrigin = '0 0';
  frame.style.transform = `translate(${geometry.x}px, ${geometry.y}px) scale(${geometry.scale})`;
  document.defaultView?.scrollTo(0, 0);
}
