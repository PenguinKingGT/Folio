/** Native glyph rectangles and SVG overlays must agree through host scaling, font preferences, and fixed page fitting. */
import { expect, test } from 'vitest';
import { Book, cfiFromRange } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { fixedFiles } from '../../unit/layout/fixed-fixture';
import { host } from '../render/fixture';
import { annotationReader, annotationGroup } from './fixture';

test('keeps highlight paint aligned with native text through font changes and host transforms', async () => {
  const { reader, container, range, cfi, release } = await annotationReader();
  try {
    container.style.transformOrigin = '0 0';
    container.style.transform = 'translate(0.43333px,0.3333px) scale(0.8,0.9)';
    const annotation = reader.annotations.highlight(cfi);
    const original = annotationGroup(reader, annotation.id)?.getBoundingClientRect().width ?? 0;
    await reader.themes.fontSize(24);
    await reader.annotations.whenIdle();
    const group = annotationGroup(reader, annotation.id);
    expect(group?.getBoundingClientRect().width).toBeGreaterThan(original);
    const frame = reader.getRenderedPages()[0]?.frame;
    if (!frame || !group) {
      throw new Error('Missing transformed annotation geometry.');
    }
    const bounds = frame.getBoundingClientRect();
    const painted = Array.from(group.querySelectorAll('rect'), (rect) =>
      rect.getBoundingClientRect(),
    );
    for (const rect of Array.from(range.getClientRects())) {
      const x = bounds.left + (rect.left * bounds.width) / frame.clientWidth;
      const y = bounds.top + (rect.top * bounds.height) / frame.clientHeight;
      expect(
        painted.some(
          (box) =>
            box.left <= x + 0.5 &&
            box.right >= x - 0.5 &&
            box.top <= y + 0.5 &&
            box.bottom >= y - 0.5,
        ),
      ).toBe(true);
    }
    container.style.width = '250px';
    reader.layout();
    await reader.annotations.whenIdle();
    expect(annotationGroup(reader, annotation.id)).not.toBeNull();
  } finally {
    release();
  }
});

test('projects glyph ranges through the fixed page native viewport scale', async () => {
  const book = await Book.open(bookZip(fixedFiles()));
  const container = host();
  const reader = book.renderTo(container, { spread: 'none' });
  try {
    await reader.display();
    const document = reader.getContents();
    const text = document?.querySelector('p')?.firstChild;
    if (!document || !text) {
      throw new Error('Missing fixed-page text.');
    }
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 8);
    const cfi = cfiFromRange(range, { base: '/6/2[chapter]' }).toString();
    const annotation = reader.annotations.highlight(cfi);
    const painted = annotationGroup(reader, annotation.id)
      ?.querySelector('rect')
      ?.getBoundingClientRect();
    const glyph = range.getBoundingClientRect();
    const frame = reader.frame.getBoundingClientRect();
    const scale = frame.width / reader.frame.clientWidth;
    expect(painted?.left).toBeCloseTo(frame.left + glyph.left * scale, 1);
    expect(painted?.width).toBeCloseTo(glyph.width * scale, 1);
    expect(painted?.top).toBeCloseTo(frame.top + glyph.top * scale, 1);
  } finally {
    book.destroy();
    container.remove();
  }
});
