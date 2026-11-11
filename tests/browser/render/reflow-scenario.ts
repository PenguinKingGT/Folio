/** Shared cross-engine reflow scenario driven by native frame resizing and media emulation. */
import { Book, rangeFromCfi } from '../../../src/index';
import type { Rendition, ReadingFlow } from '../../../src/index';

/** Observable cross-engine geometry and anchor containment results. */
export interface ReflowResult {
  resized: boolean;
  media: boolean;
  restored: boolean;
  width: number;
  length: number;
  expanded: number;
  debug: string;
}

/** Wait for a completed layout that satisfies the observable condition. */
function changed(reader: Rendition, condition: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = reader.onRelocated(() => {
      if (condition()) {
        unsubscribe();
        resolve();
      }
    });
  });
}

/** Compare native positions so assertions remain valid after ID-based CFI recovery. */
function contains(reader: Rendition, cfi: string): boolean {
  const location = reader.currentLocation();
  const document = reader.getContents();
  if (location === null || document === null) {
    return false;
  }
  const point = rangeFromCfi(document, cfi);
  return (
    rangeFromCfi(document, location.start.cfi).compareBoundaryPoints(0, point) <= 0 &&
    rangeFromCfi(document, location.end.cfi).compareBoundaryPoints(0, point) >= 0
  );
}

/** Retain one original anchor while the test driver changes the media environment. */
export async function runReflowScenario(url: string, flow: ReadingFlow): Promise<ReflowResult> {
  const book = await Book.open(url);
  const host = document.createElement('div');
  host.style.width = '320px';
  host.style.height = '240px';
  document.body.appendChild(host);
  const reader = book.renderTo(host, { flow });
  try {
    await reader.display('#end');
    const anchor = reader.currentLocation()?.start.cfi ?? '';
    const resize = changed(reader, () => reader.getContents()?.body.clientWidth === 500);
    host.style.width = '500px';
    await resize;
    const resized = contains(reader, anchor);
    const debug = JSON.stringify({ anchor, resized: reader.currentLocation() });
    const length = reader.flowState?.length ?? 0;
    const media = changed(reader, () => (reader.flowState?.length ?? 0) > length);
    host.id = 'reflow-ready';
    await media;
    const preserved = contains(reader, anchor);
    const expanded = reader.flowState?.length ?? 0;
    const restore = changed(reader, () => (reader.flowState?.length ?? 0) < expanded);
    host.id = 'reflow-restore-ready';
    await restore;
    return {
      resized,
      media: preserved,
      restored: contains(reader, anchor),
      width: reader.frame.getBoundingClientRect().width,
      length,
      expanded,
      debug,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
