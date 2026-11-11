/** Keep a passive reader mounted between real Playwright mouse input and observable policy assertions. */
import { Book } from '../../../src/index';
import type { Rendition } from '../../../src/index';

let mounted: { book: Book; reader: Rendition; host: HTMLDivElement; document: Document } | null =
  null;

/** Put the external link inside the visible viewport without changing publication script permissions. */
export async function mountClickReader(): Promise<void> {
  const host = document.createElement('div');
  host.id = 'interaction-click-host';
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:100;width:320px;height:240px';
  document.body.appendChild(host);
  const book = await Book.open('/interactions.epub');
  const reader = book.renderTo(host, { spread: 'none' });
  await reader.display();
  const content = reader.getContents();
  if (!content) {
    throw new Error('Missing click document.');
  }
  mounted = { book, reader, host, document: content };
}

/** Native outbound clicks cannot replace srcdoc, including when a frame suppresses its own event handlers. */
export function clickReaderState(): {
  same: boolean;
  chapter: number | undefined;
  href: string | null | undefined;
} {
  return {
    same: mounted?.reader.frame.contentDocument === mounted?.document,
    chapter: mounted?.reader.currentSection?.index,
    href: mounted?.document.getElementById('external')?.getAttribute('href'),
  };
}

/** Release resources independently of the browser's test-context cleanup. */
export function disposeClickReader(): void {
  mounted?.book.destroy();
  mounted?.host.remove();
  mounted = null;
}
