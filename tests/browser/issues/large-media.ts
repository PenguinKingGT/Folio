/** Original oversized artwork fixture for measuring readable page bounds and fragment navigation. */
import { book, host } from '../render/fixture';
import type { RenditionOptions } from '../../../src/index';

/** A local authored SVG image avoids external files, image rights, and unpredictable asset latency. */
export const largeArtwork = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="2000" viewBox="0 0 1000 2000"><rect width="1000" height="2000" fill="red"/><circle cx="500" cy="1000" r="200" fill="blue"/></svg>`;

/** Build a chapter whose image follows enough text to require a real page turn. */
export function largeMediaChapter(): string {
  const image = 'data:image/svg+xml,' + encodeURIComponent(largeArtwork);
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{font:16px/20px monospace;margin:0}figure{margin:0}img{display:block}</style></head><body><p>${'Original text before the illustration. '.repeat(80)}</p><figure id="art"><img width="1000" height="2000" src="${image}"/></figure><p id="end">After the artwork</p></body></html>`;
}

/** Read native geometry after navigating to artwork, without repairing its layout in the test. */
export async function largeMediaScenario(options: RenditionOptions = {}): Promise<{
  width: number;
  height: number;
  left: number;
  top: number;
  scroll: number;
  attributes: string[];
}> {
  const publication = await book(largeMediaChapter());
  const container = host();
  const reader = publication.renderTo(container, { spread: 'none', gap: 0, ...options });
  try {
    await reader.display('#art');
    const content = reader.getContents();
    const image = content?.querySelector('img');
    if (!content || !image) {
      throw new Error('Missing oversized artwork.');
    }
    await image.decode();
    const bounds = image.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
      scroll:
        reader.flowState?.axis === 'vertical'
          ? (content.defaultView?.scrollY ?? 0)
          : (content.defaultView?.scrollX ?? 0),
      attributes: [image.getAttribute('width') ?? '', image.getAttribute('height') ?? ''],
    };
  } finally {
    publication.destroy();
    container.remove();
  }
}
