/** Observe real user scrolling independently of public navigation calls and manual annotation refresh. */
import { Book, cfiFromRange } from '../../../src/index';
import type { Rendition, ContinuousReader } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles } from '../continuous/fixture';
import { navigationFiles } from '../render/navigation-fixture';

let mounted: {
  book: Book;
  reader: Rendition | ContinuousReader;
  host: HTMLDivElement;
  events: number;
} | null = null;

/** Keep native iframe content under the real pointer so Playwright can dispatch a physical wheel gesture. */
export async function mountNativeAnnotationScroll(continuous = false): Promise<void> {
  const book = await Book.open(bookZip(continuous ? continuousFiles(8, 100) : navigationFiles()));
  const host = document.createElement('div');
  host.id = 'native-annotation-scroll';
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:100;width:320px;height:240px';
  document.body.appendChild(host);
  const reader = continuous
    ? book.renderContinuous(host)
    : book.renderTo(host, { flow: 'scrolled-doc' });
  mounted = { book, reader, host, events: 0 };
  await reader.display();
  const content = reader.getContents();
  const text = content?.querySelector('p')?.firstChild;
  if (!content || !text) {
    throw new Error('Missing original long chapter.');
  }
  const range = content.createRange();
  range.setStart(text, 0);
  range.setEnd(text, 40);
  reader.annotations.highlight(cfiFromRange(range, { base: '/6/2[chapter]' }).toString());
  reader.onRelocated(() => {
    if (mounted) {
      mounted.events++;
    }
  });
}

/** Reading state must be observable without calling layout(), display(), or refresh() to repair it. */
export function nativeAnnotationScrollState(): {
  scroll: number;
  events: number;
  paint: number;
  firstLoaded: boolean;
} {
  const reader = mounted?.reader;
  return {
    scroll:
      reader && 'viewport' in reader
        ? reader.viewport.scrollTop
        : (reader?.getContents()?.defaultView?.scrollY ?? 0),
    events: mounted?.events ?? 0,
    paint: mounted?.reader.annotations.element.querySelectorAll('rect').length ?? 0,
    firstLoaded:
      reader && 'loadedSections' in reader
        ? reader.loadedSections.some((section) => section.index === 0)
        : reader?.currentSection?.index === 0,
  };
}

/** Dispose every reader-owned callback and native surface after the gesture scenario. */
export function disposeNativeAnnotationScroll(): void {
  mounted?.book.destroy();
  mounted?.host.remove();
  mounted = null;
}
