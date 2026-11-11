/** Exercise stable native contexts and virtual scrolling without depending on engine-specific glyph metrics. */
import { Book, Cfi } from '../../../src/index';
import type { ContinuousReader, ReadingAxis } from '../../../src/index';

/** Engine-independent assertions returned to the Playwright host. */
interface ContinuousResult {
  axis: ReadingAxis | undefined;
  reverse: boolean | undefined;
  native: number;
  retained: boolean;
  stable: boolean;
  atEnd: boolean | undefined;
  atStart: boolean | undefined;
  bounded: boolean;
  trimmed: boolean;
  internal: boolean;
}

/** Visit the last and first chapter after trimming. */
async function boundaries(reader: ContinuousReader) {
  await reader.display('s7.xhtml#end-7');
  await reader.whenIdle();
  const atEnd = reader.currentLocation()?.atEnd;
  await reader.display(0);
  await reader.whenIdle();
  return {
    atEnd,
    atStart: reader.currentLocation()?.atStart,
    bounded: reader.loadedSections.length <= 3,
    internal:
      reader.getContents()?.defaultView?.scrollX === 0 &&
      reader.getContents()?.defaultView?.scrollY === 0,
  };
}

/** Confirm a logical reading point remains inside the clipped viewport after reflow. */
function contains(reader: ContinuousReader, point: string): boolean {
  const location = reader.currentLocation();
  return (
    location !== null &&
    new Cfi(location.start.cfi).compare(new Cfi(point)) <= 0 &&
    new Cfi(location.end.cfi).compare(new Cfi(point)) >= 0
  );
}

/** Return externally observable behavior for all three browser engines. */
export async function runContinuousScenario(): Promise<ContinuousResult> {
  const host = document.createElement('div');
  host.style.width = '320px';
  host.style.height = '240px';
  document.body.appendChild(host);
  const book = await Book.open('/continuous.epub');
  const reader = book.renderContinuous(host);
  try {
    await reader.display(4);
    await reader.next();
    const point = reader.currentLocation()?.start.cfi ?? '';
    const original = reader.getLoadedPages().find((page) => page.section.index === 4);
    const state = reader.flowState;
    const native =
      state?.axis === 'horizontal' ? reader.viewport.scrollLeft : reader.viewport.scrollTop;
    host.style.width = '250px';
    host.style.height = '200px';
    reader.layout();
    await reader.whenIdle();
    const retained = contains(reader, point);
    await reader.display(5);
    const same = reader.getLoadedPages().find((page) => page.section.index === 4);
    const stable =
      same?.document === original?.document && same?.frame.contentDocument === same?.document;
    const ends = await boundaries(reader);
    return {
      axis: state?.axis,
      reverse: state?.reverse,
      native,
      retained,
      stable,
      ...ends,
      trimmed: original?.frame.isConnected === false,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
