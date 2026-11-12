/** Upstream #1384: resizing a pending initial display must retain its destination and commit current geometry. */
import type { Book, Rendition } from '../../../src/index';
import { gate } from '../../unit/extensions/fixture';

/** Pause a real lifecycle phase, resize before commit, and retain the reader for post-commit native resize assertions. */
export async function initialResize(
  book: Book,
  phase: 'content' | 'render',
): Promise<{ book: Book; host: HTMLDivElement; reader: Rendition }> {
  const entered = gate();
  const release = gate();
  book.hooks[phase].register(async () => {
    entered.release();
    await release.promise;
  });
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  const reader = book.renderTo(host);
  const pending = reader.display('#end');
  try {
    await entered.promise;
    host.style.width = '500px';
    window.dispatchEvent(new Event('resize'));
    await nextFrame();
    release.release();
    await pending;
    return { book, host, reader };
  } catch (error) {
    book.destroy();
    host.remove();
    throw error;
  } finally {
    release.release();
  }
}

/** Synchronize native rendering tasks without wall-clock sleeps. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Cross-engine scenario records both pending-display resize and post-commit observation without exposing DOM objects. */
export async function runInitialResize(
  book: Book,
  phase: 'content' | 'render',
): Promise<{
  initial: number | undefined;
  visible: boolean;
  width: number | undefined;
  retained: boolean;
  destination: boolean;
}> {
  const { reader, host } = await initialResize(book, phase);
  try {
    const initial = reader.pagination?.width;
    const visible = endVisible(reader) && !reader.frame.hidden;
    const document = reader.getContents();
    host.style.width = '640px';
    for (let frame = 0; frame < 60 && reader.pagination?.width !== 640; frame++) {
      await nextFrame();
    }
    return {
      initial,
      visible,
      width: reader.pagination?.width,
      retained: reader.getContents() === document,
      destination: endVisible(reader),
    };
  } finally {
    book.destroy();
    host.remove();
  }
}

/** A chapter-ending target can be visible before the publication's final section, so atEnd is not an anchor assertion. */
export function endVisible(reader: Rendition): boolean {
  const rect = reader.getContents()?.getElementById('end')?.getBoundingClientRect();
  return (
    rect !== undefined &&
    rect.right > 0 &&
    rect.left < reader.frame.clientWidth &&
    rect.bottom > 0 &&
    rect.top < reader.frame.clientHeight
  );
}
