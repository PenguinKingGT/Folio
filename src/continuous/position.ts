/** Preserve reading anchors while virtual spacers, expanded pages, and physical layout dimensions change. */
import { targetRect } from '../render/position';
import type { ResolvedTarget } from '../render/target';
import type { VisibleLocation } from '../render/location-types';
import { Cfi } from '../cfi/cfi';
import type { ContinuousPage } from './page';
import type { ContinuousPort } from './port';
import type { ContinuousWindow } from './window';

/** Unloaded positions retain a relative estimate; loaded positions can retain an exact CFI. */
export interface ReadingReference {
  readonly index: number;
  readonly local: number;
  readonly fractional: boolean;
  readonly cfi: string | null;
}

/** Capture before modifying offsets or iframe dimensions. */
export function readingReference(
  port: ContinuousPort,
  window: ContinuousWindow,
  snapshot: VisibleLocation | null,
): ReadingReference | null {
  const section = window.offsets.at(port.offset());
  if (section === null) {
    return null;
  }
  const page = window.get(section.index);
  const local = Math.max(0, port.offset() - window.offsets.start(section.index));
  return {
    index: section.index,
    local: page === null ? local / window.offsets.extent(section.index) : local,
    fractional: page === null,
    cfi: snapshot?.start.index === section.index ? snapshot.start.cfi : null,
  };
}

/** Convert a native destination to the page's outer logical pixel coordinate. */
export function pagePosition(page: ContinuousPage, target: ResolvedTarget): number {
  const rect = targetRect(page.rendered().document, target);
  if (rect === null) {
    return 0;
  }
  const { writing, scale, extent } = page.measured;
  if (writing.axis === 'vertical') {
    return Math.max(0, rect.top * scale);
  }
  return Math.max(0, writing.reverse ? extent - rect.right * scale : rect.left * scale);
}

/** Clamp to the real outer scrollport, never to a chapter's removed internal scrollbar. */
export function scrollToPosition(
  port: ContinuousPort,
  window: ContinuousWindow,
  position: number,
): void {
  const state = port.state(window.offsets.total);
  if (state !== null) {
    port.scroll(Math.max(0, Math.min(position, Math.max(0, state.length - state.viewport))));
  }
}

/** Restore pixels for view trimming, or an exact CFI after reflow of visible content. */
export function restoreReference(
  port: ContinuousPort,
  window: ContinuousWindow,
  reference: ReadingReference | null,
  useCfi: boolean,
): void {
  if (reference === null) {
    return;
  }
  const page = window.get(reference.index);
  if (page === null) {
    return;
  }
  let local = reference.fractional ? reference.local * page.measured.extent : reference.local;
  if (useCfi && reference.cfi !== null) {
    local = pagePosition(page, {
      section: page.section,
      cfi: new Cfi(reference.cfi),
      fragment: null,
    });
  }
  scrollToPosition(
    port,
    window,
    window.offsets.start(reference.index) + Math.min(page.measured.extent, local),
  );
}
