/** Upstream #1408: late loading and predecessor reflow cannot overwrite a committed distant chapter destination. */
import { Book, Cfi } from '../../../src/index';
import type { ContinuousReader } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles } from '../continuous/fixture';
import { gate } from '../../unit/extensions/fixture';
import { host as createHost } from '../render/fixture';
import { nextFrame } from './initial-resize';

/** Hold shared chapter I/O without replacing native view or scroll behavior. */
async function delayedBook(): Promise<{
  book: Book;
  entered: ReturnType<typeof gate>;
  release: ReturnType<typeof gate>;
}> {
  const book = await Book.open(bookZip(continuousFiles(12, 100)));
  const entered = gate();
  const release = gate();
  book.hooks.content.register(async ({ section }) => {
    if (section.index === 1) {
      entered.release();
      await release.promise;
    }
  });
  return { book, entered, release };
}

/** Compare structural CFI intervals after a predecessor changes absolute virtual offsets. */
function retains(reader: ContinuousReader, anchor: string): boolean {
  const location = reader.currentLocation();
  return (
    location !== null &&
    new Cfi(location.start.cfi).compare(anchor) <= 0 &&
    new Cfi(location.end.cfi).compare(anchor) >= 0
  );
}

/** Expand and shrink the actual predecessor document; both measurements must preserve the target anchor. */
async function reflow(
  reader: ContinuousReader,
  anchor: string,
): Promise<{ measured: boolean; retained: boolean }> {
  const page = reader.getLoadedPages().find((entry) => entry.section.index === 7);
  if (page === undefined) {
    throw new Error('Expected the distant destination predecessor.');
  }
  const initial = page.frame.getBoundingClientRect().height;
  const style = page.document.createElement('style');
  page.document.head.appendChild(style);
  style.textContent = 'p{font-size:28px!important;line-height:35px!important}';
  await nextFrame();
  await reader.whenIdle();
  const measured = page.frame.getBoundingClientRect().height > initial;
  const expanded = retains(reader, anchor);
  style.textContent = 'p{font-size:10px!important;line-height:12px!important}';
  await nextFrame();
  await reader.whenIdle();
  return { measured, retained: expanded && retains(reader, anchor) };
}

/** Observe rejection of the superseded display, then release late work only after the distant destination commits. */
export async function lateNavigation(): Promise<{
  cancelled: boolean;
  section: number | undefined;
  retained: boolean;
  measured: boolean;
  bounded: boolean;
  error: boolean;
}> {
  const { book, entered, release } = await delayedBook();
  const host = createHost();
  const reader = book.renderContinuous(host);
  const obsolete = reader.display().then(
    () => null,
    (error: unknown) => error,
  );
  try {
    await entered.promise;
    await reader.display('s8.xhtml#end-8');
    await reader.whenIdle();
    const anchor = reader.currentLocation()?.start.cfi;
    if (anchor === undefined) {
      throw new Error('Expected a committed distant reading position.');
    }
    release.release();
    await book.section(1)?.load();
    const error = await obsolete;
    await reader.whenIdle();
    const retained = retains(reader, anchor);
    const changed = await reflow(reader, anchor);
    return {
      cancelled: error instanceof DOMException && error.name === 'AbortError',
      section: reader.currentSection?.index,
      retained: retained && changed.retained,
      measured: changed.measured,
      bounded:
        reader.loadedSections.length <= 3 && reader.viewport.querySelectorAll('iframe').length <= 3,
      error: reader.lastError !== null,
    };
  } finally {
    release.release();
    book.destroy();
    host.remove();
    await obsolete;
  }
}
