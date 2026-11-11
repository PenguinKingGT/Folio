/** Original fixed-layout publication fixtures with four independently authored XHTML pages. */
import { bookFiles } from '../book/fixture';

/** A viewport with percentage and fixed-position content tests the original containing block. */
export function fixedChapter(index: number, viewport = 'width=600,height=800'): string {
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head><meta name="viewport" content="${viewport}"/><style>html,body{margin:0;width:100%;height:100%}p{font:24px/30px monospace;margin:0}#position{position:fixed;left:50%;top:50%}</style></head><body><p id="page-${index}">Original fixed page ${index}</p><p id="position">Native coordinates</p></body></html>`;
}

/** Generate a complete fixed-layout book with optional spine overrides and page progression. */
export function fixedFiles(
  properties: readonly string[] = [],
  direction: 'ltr' | 'rtl' = 'ltr',
  spread = 'auto',
): Map<string, string> {
  const files = bookFiles();
  let xml = (files.get('OPS/package.opf') ?? '').replace(
    '>reflowable</meta>',
    '>pre-paginated</meta>',
  );
  xml = xml.replace('</metadata>', `<meta property="rendition:spread">${spread}</meta></metadata>`);
  const items: string[] = [];
  const spine: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const id = index === 0 ? 'chapter' : `p${index}`;
    const path = index === 0 ? 'text/chapter one.xhtml' : `${id}.xhtml`;
    if (index > 0) {
      items.push(`<item id="${id}" href="${path}" media-type="application/xhtml+xml"/>`);
    }
    spine.push(`<itemref idref="${id}" properties="${properties[index] ?? ''}"/>`);
    files.set(`OPS/${path}`, fixedChapter(index));
  }
  xml = xml.replace('</manifest>', `${items.join('')}</manifest>`);
  xml = xml.replace(
    /<spine[^>]*>[\s\S]*?<\/spine>/,
    `<spine page-progression-direction="${direction}">${spine.join('')}</spine>`,
  );
  files.set('OPS/package.opf', xml);
  return files;
}
