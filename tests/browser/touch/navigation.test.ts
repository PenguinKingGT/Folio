/** Native touch navigation must follow pagination geometry and preserve ordinary document scrolling. */
import { expect, test } from 'vitest';
import { touchReader, swipe } from './fixture';
import { writingFiles } from '../render/writing-fixture';
import { fixedFiles } from '../../unit/layout/fixed-fixture';
import { continuousBook } from '../continuous/fixture';
import { host } from '../render/fixture';

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`touch turns ${mode} ${direction} pages using the effective inline axis`, async () => {
      const { reader, release } = await touchReader({ touch: true }, writingFiles(mode, direction));
      try {
        const document = reader.getContents();
        const state = reader.flowState;
        if (!document || !state) {
          throw new Error('Missing touch document geometry.');
        }
        const distance = state.reverse ? 100 : -100;
        expect(
          swipe(
            document.body,
            state.axis === 'horizontal' ? distance : 0,
            state.axis === 'vertical' ? distance : 0,
          ),
        ).toBe(true);
        await reader.touch.whenIdle();
        expect(reader.currentLocation()?.start.displayed.page).toBe(2);
        expect(document.documentElement.style.touchAction).toBe(
          state.axis === 'horizontal' ? 'pan-y pinch-zoom' : 'pan-x pinch-zoom',
        );
        swipe(
          document.body,
          state.axis === 'horizontal' ? -distance : 0,
          state.axis === 'vertical' ? -distance : 0,
        );
        await reader.touch.whenIdle();
        expect(reader.currentLocation()?.atStart).toBe(true);
      } finally {
        release();
      }
    });
  }
}

test('snaps native paginated scrolling to the nearest spread, including the book end', async () => {
  const { reader, release } = await touchReader();
  try {
    const document = reader.getContents();
    const pages = reader.pagination;
    if (!document || !pages) {
      throw new Error('Missing pagination.');
    }
    document.defaultView?.scrollTo(pages.advance * 1.6, 0);
    document.dispatchEvent(new Event('scrollend'));
    expect(document.defaultView?.scrollX).toBe(pages.advance * 2);
    reader.touch.snap();
    expect(document.defaultView?.scrollX).toBe(pages.advance * 2);
    document.defaultView?.scrollTo(document.documentElement.scrollWidth, 0);
    reader.touch.snap();
    expect(reader.currentLocation()?.atEnd).toBe(true);
  } finally {
    release();
  }
});

test('leaves disabled and natural scrolling readers in control of native input', async () => {
  for (const options of [{ touch: false }, { touch: true, flow: 'scrolled-doc' }] as const) {
    const { reader, release } = await touchReader(options);
    try {
      const document = reader.getContents();
      if (!document) {
        throw new Error('Missing native document.');
      }
      expect(swipe(document.body)).toBe(false);
      reader.touch.snap();
      await reader.touch.whenIdle();
      expect(reader.currentLocation()?.atStart).toBe(true);
      expect(document.documentElement.style.touchAction).toBe('');
    } finally {
      release();
    }
  }
  const book = await continuousBook();
  const container = host();
  try {
    const reader = book.renderContinuous(container, { touch: true });
    await reader.display();
    reader.touch.snap();
    expect(swipe(reader.getContents()?.body ?? reader.viewport, 0, -100)).toBe(false);
    expect(reader.currentLocation()?.atStart).toBe(true);
  } finally {
    book.destroy();
    container.remove();
  }
});

test('turns fixed RTL spreads in reading order and rebinds their native documents', async () => {
  const { reader, release } = await touchReader({ touch: true }, fixedFiles([], 'rtl'));
  try {
    const first = reader.getContents();
    if (!first) {
      throw new Error('Missing fixed document.');
    }
    swipe(first.body, 100);
    await reader.touch.whenIdle();
    expect(reader.currentSection?.index).toBe(1);
    expect(first.documentElement.style.touchAction).toBe('');
    const current = reader.getContents();
    if (!current) {
      throw new Error('Missing new fixed document.');
    }
    swipe(current.body, -100);
    await reader.touch.whenIdle();
    expect(reader.currentSection?.index).toBe(0);
    reader.flow('scrolled-doc');
    reader.touch.refresh();
  } finally {
    release();
  }
});
