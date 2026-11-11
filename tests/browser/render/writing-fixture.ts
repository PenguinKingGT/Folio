/** Original multilingual writing-mode fixtures exercise native columns and bidi coordinates. */
import { Book } from '../../../src/index';
import type { TextDirection, WritingMode } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';

/** Mix Latin and CJK characters while keeping layout deterministic through explicit line metrics. */
export function writingChapter(mode: WritingMode, direction: TextDirection): string {
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>body{writing-mode:${mode};direction:${direction}}p{font:16px/20px monospace;margin:0}</style></head><body><p id="start">${'Original 竖排阅读 text. '.repeat(250)}</p><p id="end">Final destination</p></body></html>`;
}

/** Open a local complete publication with optional OPF page-progression direction. */
export function writingFiles(
  mode: WritingMode,
  direction: TextDirection,
  progression = 'default',
): Map<string, string> {
  const files = bookFiles();
  files.set('OPS/text/chapter one.xhtml', writingChapter(mode, direction));
  if (progression !== 'default') {
    files.set(
      'OPS/package.opf',
      (files.get('OPS/package.opf') ?? '').replace(
        '<spine ',
        `<spine page-progression-direction="${progression}" `,
      ),
    );
  }
  return files;
}

/** Open the original publication without external requests. */
export function writingBook(
  mode: WritingMode,
  direction: TextDirection,
  progression = 'default',
): Promise<Book> {
  return Book.open(bookZip(writingFiles(mode, direction, progression)));
}
