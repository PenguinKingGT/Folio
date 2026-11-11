/** Keep a real mobile touch reader alive between browser-protocol contact commands. */
import { Book } from '../../../src/index';
import type { Rendition } from '../../../src/index';

let mounted: { book: Book; reader: Rendition; host: HTMLDivElement } | null = null;

/** Place a native iframe within the visible viewport and return a contact coordinate. */
export async function mountMobileReader(): Promise<{ x: number; y: number }> {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:100;width:320px;height:240px';
  document.body.appendChild(host);
  const book = await Book.open('/touch.epub');
  const reader = book.renderTo(host, { touch: true, spread: 'none' });
  mounted = { book, reader, host };
  await reader.display();
  return { x: 220, y: 120 };
}

/** Await accepted native contacts and expose the resulting reading viewport. */
export async function mobilePage(): Promise<number | undefined> {
  await mounted?.reader.touch.whenIdle();
  return mounted?.reader.currentLocation()?.start.displayed.page;
}

/** Release the complete reader even when a protocol assertion fails. */
export function disposeMobileReader(): void {
  mounted?.book.destroy();
  mounted?.host.remove();
  mounted = null;
}
