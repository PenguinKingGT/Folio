/** Upstream #1416: native scroll reversals must supersede delayed preload work without replacing the visible reading anchor. */
import { Book, Cfi } from '../../../src/index';
import type { ContinuousReader } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles } from '../continuous/fixture';
import { gate } from '../../unit/extensions/fixture';
import { host as createHost } from '../render/fixture';
import { nextFrame } from './initial-resize';

/** Read a committed section's native virtual offset without assuming unmeasured chapter lengths. */
function offset(reader: ContinuousReader, index: number): number {
  const page = reader.viewport.querySelector(`[data-folio-section="${index}"]`);
  if (!(page instanceof HTMLElement)) {
    throw new Error(`Missing committed section ${index}.`);
  }
  return page.offsetTop;
}

/** Preserve structural reading position even when measuring a predecessor changes absolute scroll coordinates. */
function contains(reader: ContinuousReader, anchor: string): boolean {
  const location = reader.currentLocation();
  return (
    location !== null &&
    new Cfi(location.start.cfi).compare(anchor) <= 0 &&
    new Cfi(location.end.cfi).compare(anchor) >= 0
  );
}

/** Alternate native directions while chapter two is held, then verify the final upward destination survives its release. */
export async function scrollReversal(): Promise<{
  section: number | undefined;
  retained: boolean;
  settled: boolean;
  bounded: boolean;
  error: boolean;
}> {
  const book = await Book.open(bookZip(continuousFiles(8, 100)));
  const entered = gate();
  const release = gate();
  book.hooks.content.register(async ({ section }) => {
    if (section.index === 2) {
      entered.release();
      await release.promise;
    }
  });
  const host = createHost();
  const reader = book.renderContinuous(host);
  try {
    await reader.display(4);
    await reader.whenIdle();
    reader.viewport.scrollTop = offset(reader, 3) - 60;
    await entered.promise;
    reader.viewport.scrollTop = offset(reader, 4) + 100;
    await reader.whenIdle();
    reader.viewport.scrollTop = offset(reader, 3) + 100;
    await nextFrame();
    const anchor = reader.currentLocation()?.start.cfi;
    if (anchor === undefined) {
      throw new Error('Expected final upward destination in an already loaded chapter.');
    }
    release.release();
    await reader.whenIdle();
    const retained = contains(reader, anchor);
    const top = reader.viewport.scrollTop;
    await nextFrame();
    await reader.whenIdle();
    return {
      section: reader.currentSection?.index,
      retained,
      settled: Math.abs(reader.viewport.scrollTop - top) < 1,
      bounded: reader.loadedSections.length <= 3,
      error: reader.lastError !== null,
    };
  } finally {
    release.release();
    book.destroy();
    host.remove();
  }
}
