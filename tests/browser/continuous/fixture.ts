/** Original multi-chapter continuous-reading fixtures with measurable, differently sized content. */
import { Book } from '../../../src/index';
import type { TextDirection, WritingMode } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';

/** Generate a natural-flow chapter with explicit line metrics and stable marker identities. */
export function continuousChapter(
  index: number,
  repeats = (index + 1) * 20,
  mode: WritingMode = 'horizontal-tb',
  direction: TextDirection = 'ltr',
): string {
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>body{writing-mode:${mode};direction:${direction}}p,h2{font:16px/20px monospace;margin:0}</style></head><body><h2 id="start-${index}">Chapter ${index}</h2><p>${'Original chapter text 竖排 '.repeat(repeats)}</p><p id="end-${index}">End ${index}</p></body></html>`;
}

/** Keep the full publication locally generated under the repository license. */
export function continuousFiles(
  count = 8,
  repeats?: number,
  mode: WritingMode = 'horizontal-tb',
  direction: TextDirection = 'ltr',
): Map<string, string> {
  const files = bookFiles();
  const manifest: string[] = [];
  const spine: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = index === 0 ? 'chapter' : `s${index}`;
    const path = index === 0 ? 'text/chapter one.xhtml' : `${id}.xhtml`;
    files.set(`OPS/${path}`, continuousChapter(index, repeats, mode, direction));
    if (index > 0) {
      manifest.push(`<item id="${id}" href="${path}" media-type="application/xhtml+xml"/>`);
    }
    spine.push(`<itemref idref="${id}"/>`);
  }
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '')
      .replace('</manifest>', `${manifest.join('')}</manifest>`)
      .replace(/<spine[^>]*>[\s\S]*?<\/spine>/, `<spine>${spine.join('')}</spine>`),
  );
  return files;
}

/** Open the complete fixture without creating any views. */
export function continuousBook(
  count = 8,
  repeats?: number,
  mode: WritingMode = 'horizontal-tb',
  direction: TextDirection = 'ltr',
): Promise<Book> {
  return Book.open(bookZip(continuousFiles(count, repeats, mode, direction)));
}
