/** Native line-level verification for cross-paragraph underlines uses an original fully selected middle paragraph. */
import type { Rendition } from '../../../src/index';
import { cfiFromRange } from '../../../src/index';
import { book, host } from '../render/fixture';

/** Compare every middle-paragraph text line with painted SVG geometry, excluding paragraph block rectangles. */
export async function paragraphUnderline(lineHeight = 24): Promise<{
  expected: number;
  matched: number;
  error: boolean;
}> {
  const publication = await book(`<html xmlns="http://www.w3.org/1999/xhtml"><head><style>
    p{font:16px/${lineHeight}px monospace;margin:0;width:220px}
    </style></head><body><p>First paragraph.</p><p id="middle">${'Original middle words. '.repeat(2)}</p><p>Last paragraph.</p></body></html>`);
  const container = host();
  try {
    const reader = publication.renderTo(container, { flow: 'scrolled-doc' });
    await reader.display();
    const document = reader.getContents();
    const first = document?.querySelector('p')?.firstChild;
    const last = document?.querySelector('p:last-child')?.firstChild;
    const middle = document?.getElementById('middle')?.firstChild;
    if (!document || !first || !last || !middle) {
      throw new Error('Expected the original three-paragraph fixture.');
    }
    const range = document.createRange();
    range.setStart(first, 2);
    range.setEnd(last, 4);
    const annotation = reader.annotations.underline(
      cfiFromRange(range, { base: '/6/2[chapter]' }).toString(),
    );
    const glyphs = document.createRange();
    glyphs.selectNodeContents(middle);
    return {
      ...measureLines(reader, glyphs, annotation.id),
      error: reader.annotations.lastError !== null,
    };
  } finally {
    publication.destroy();
    container.remove();
  }
}

/** Compare actual painted strokes with glyph bottoms rather than with full paragraph blocks. */
function measureLines(
  reader: Rendition,
  glyphs: Range,
  id: string,
): { expected: number; matched: number } {
  const frame = reader.frame.getBoundingClientRect();
  const lines = Array.from(
    reader.annotations.element.querySelectorAll(`[data-folio-annotation="${id}"] line`),
  );
  const expected = Array.from(glyphs.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  const matched = expected.filter((glyph) =>
    lines.some(
      (line) => Math.abs(line.getBoundingClientRect().top - (frame.top + glyph.bottom - 0.75)) < 2,
    ),
  );
  return { expected: expected.length, matched: matched.length };
}
