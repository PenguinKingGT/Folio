/** Touch navigation owns listeners, CSS declarations, concurrent page turns, and recoverable errors. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { host } from '../render/fixture';
import { writingFiles } from '../render/writing-fixture';
import { continuousFiles } from '../continuous/fixture';
import { bookZip } from '../../unit/book/fixture';
import { touchReader, swipe, pointer } from './fixture';

test('validates settings before either reader allocates DOM', async () => {
  const book = await Book.open(bookZip(writingFiles('horizontal-tb', 'ltr')));
  const container = host();
  try {
    expect(() => book.renderTo(container, { touch: { minDistance: 0 } })).toThrow('touch');
    expect(() => book.renderContinuous(container, { touch: { axisRatio: 0.5 } })).toThrow('touch');
    expect(container.children).toHaveLength(0);
  } finally {
    book.destroy();
    container.remove();
  }
});

test('restores owned declarations and leaves later host overrides untouched', async () => {
  const files = writingFiles('horizontal-tb', 'ltr');
  files.set(
    'OPS/text/chapter one.xhtml',
    (files.get('OPS/text/chapter one.xhtml') ?? '').replace(
      '<html ',
      '<html style="touch-action:manipulation!important" ',
    ),
  );
  const { reader, release } = await touchReader({ touch: true }, files);
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing styled document.');
    }
    reader.flow('scrolled-doc');
    expect(document.documentElement.style.touchAction).toBe('manipulation');
    expect(document.documentElement.style.getPropertyPriority('touch-action')).toBe('important');
    reader.flow('paginated');
    document.documentElement.style.setProperty('touch-action', 'none', 'important');
    reader.touch.destroy();
    reader.touch.destroy();
    reader.touch.refresh();
    reader.touch.snap();
    expect(document.documentElement.style.touchAction).toBe('none');
    expect(swipe(document.body)).toBe(false);
  } finally {
    release();
  }
});

test('coalesces rapid contacts and reports failed chapter turns without unhandled rejections', async () => {
  const files = continuousFiles(2, 0);
  files.delete('OPS/s1.xhtml');
  const { reader, release } = await touchReader({ touch: true }, files);
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing source chapter.');
    }
    swipe(document.body);
    swipe(document.body);
    await expect(reader.touch.whenIdle()).rejects.toThrow();
    expect(reader.touch.lastError).toBeInstanceOf(Error);
    // A backward boundary gesture succeeds and clears the previous retained failure.
    swipe(document.body, 100);
    await reader.touch.whenIdle();
    expect(reader.touch.lastError).toBeNull();
    pointer(document.body, 'pointerdown');
    pointer(document.body, 'pointerup');
    expect(reader.currentSection?.index).toBe(0);
  } finally {
    release();
  }
});

test('rejects a gesture if text selection appears after pointer-down', async () => {
  const { reader, release } = await touchReader();
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing selectable document.');
    }
    pointer(document.body, 'pointerdown');
    const range = document.createRange();
    range.selectNodeContents(document.body);
    document.getSelection()?.addRange(range);
    pointer(document.body, 'pointerup', { clientX: -100 });
    await reader.touch.whenIdle();
    expect(reader.currentLocation()?.atStart).toBe(true);
    document.getSelection()?.removeAllRanges();
  } finally {
    release();
  }
});
