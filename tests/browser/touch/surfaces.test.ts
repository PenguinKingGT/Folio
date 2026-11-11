/** Caller-owned gesture surfaces preserve passive-frame isolation and reader-owned cleanup. */
import { expect, test } from 'vitest';
import { touchReader, swipe, pointer } from './fixture';
import { continuousBook } from '../continuous/fixture';
import { host } from '../render/fixture';

test('host surfaces turn pages, preserve chapter selection, and release idempotently', async () => {
  const { reader, release } = await touchReader();
  const surface = host();
  surface.style.touchAction = 'manipulation';
  try {
    const detach = reader.touch.bind(surface);
    expect(swipe(surface)).toBe(true);
    await reader.touch.whenIdle();
    expect(reader.currentLocation()?.start.displayed.page).toBe(2);
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing selected chapter.');
    }
    const range = document.createRange();
    range.selectNodeContents(document.body);
    document.getSelection()?.addRange(range);
    expect(swipe(surface)).toBe(false);
    document.getSelection()?.removeAllRanges();
    expect(swipe(surface, 100)).toBe(true);
    await reader.touch.whenIdle();
    expect(reader.currentLocation()?.atStart).toBe(true);
    detach();
    detach();
    expect(surface.style.touchAction).toBe('manipulation');
    expect(swipe(surface)).toBe(false);
  } finally {
    release();
    surface.remove();
  }
});

test('host surfaces restore natural scrolling styles after flow changes and reader destruction', async () => {
  const { reader, release } = await touchReader();
  const surface = host();
  surface.style.touchAction = 'manipulation';
  try {
    reader.touch.bind(surface);
    reader.flow('scrolled-doc');
    expect(surface.style.touchAction).toBe('manipulation');
    expect(swipe(surface)).toBe(false);
    reader.flow('paginated');
    expect(surface.style.touchAction).toBe('pan-y pinch-zoom');
    // Malformed synthetic events cannot masquerade as native Pointer Events.
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      surface.dispatchEvent(new Event(type));
    }
    pointer(surface, 'pointerdown');
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing chapter selection.');
    }
    const range = document.createRange();
    range.selectNodeContents(document.body);
    document.getSelection()?.addRange(range);
    pointer(surface, 'pointerup', { clientX: -100 });
    document.getSelection()?.removeAllRanges();
    reader.destroy();
    expect(surface.style.touchAction).toBe('manipulation');
    expect(() => reader.touch.bind(surface)).toThrow('destroyed');
  } finally {
    release();
    surface.remove();
  }
});

test('validates host surface ownership and keeps continuous gestures native before and after display', async () => {
  const { reader, release } = await touchReader({ touch: false });
  const surface = host();
  try {
    expect(() => reader.touch.bind(surface)).toThrow('disabled');
  } finally {
    release();
  }
  const book = await continuousBook();
  const container = host();
  try {
    const continuous = book.renderContinuous(container, { touch: true });
    expect(() => continuous.touch.bind(document.createElement('div'))).toThrow('attached');
    const detach = continuous.touch.bind(surface);
    await continuous.display();
    expect(swipe(surface)).toBe(false);
    expect(surface.style.touchAction).toBe('');
    detach();
  } finally {
    book.destroy();
    container.remove();
    surface.remove();
  }
});
