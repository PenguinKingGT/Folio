/** Upstream #1326: font reflow must retain correct previous-chapter final-page and subsequent forward navigation. */
import type { Book } from '../../../src/index';
import { endVisible } from './initial-resize';

/** Inspect both geometry and actual computed font size before and after crossing a linear chapter boundary. */
export async function fontBoundary(
  book: Book,
  size: '80%' | '120%',
): Promise<{ font: number; previous: number | null; finalVisible: boolean; next: number | null }> {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  try {
    const reader = book.renderTo(host);
    await reader.display(2);
    await reader.themes.fontSize(size);
    const previous = await reader.prev();
    const content = reader.getContents();
    const font = Number.parseFloat(
      content?.defaultView?.getComputedStyle(content.body).fontSize ?? '0',
    );
    const finalVisible = endVisible(reader);
    const next = await reader.next();
    return { font, previous: previous?.index ?? null, finalVisible, next: next?.index ?? null };
  } finally {
    book.destroy();
    host.remove();
  }
}
