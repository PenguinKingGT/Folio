/** Typed reader events observe real native chapters, selections, host annotations, errors, and destruction. */
import { expect, expectTypeOf, test } from 'vitest';
import { Book, rangeFromCfi } from '../../../src/index';
import type { Rendition, ContinuousReader } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { host } from '../render/fixture';
import { interactionFiles, selectText, click } from '../interaction/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} typed events forward committed reading and interaction state`, async () => {
    const book = await Book.open(bookZip(interactionFiles()));
    const container = host();
    const created: unknown[] = [];
    book.once('readerCreated', (reader) => created.push(reader));
    const reader = continuous ? book.renderContinuous(container) : book.renderTo(container);
    const displayed: number[] = [];
    const selected: string[] = [];
    const clicks: unknown[] = [];
    let relocated = 0;
    let closed = 0;
    reader.on('displayed', (section) => displayed.push(section.index));
    reader.on('relocated', (location) => {
      expectTypeOf(location.start.cfi).toEqualTypeOf<string>();
      relocated += 1;
    });
    reader.on('selected', (selection) => {
      if (selection) {
        selected.push(selection.text);
      }
    });
    reader.on('annotationClick', (event) => clicks.push(event.annotation.data));
    reader.once('destroyed', () => {
      closed += 1;
    });
    try {
      await reader.display();
      const text = exerciseSelection(reader);
      expect(created).toEqual([reader]);
      expect(displayed).toEqual([0]);
      expect(selected).toEqual([text]);
      expect(clicks).toEqual(['original']);
      expect(relocated).toBeGreaterThan(0);
      reader.destroy();
      reader.destroy();
      expect(closed).toBe(1);
      expect(() => reader.on('selected', () => {})).toThrow('destroyed');
    } finally {
      book.destroy();
      container.remove();
    }
  });
}

/** Select native text and activate a host annotation while verifying its exact range CFI. */
function exerciseSelection(reader: Rendition | ContinuousReader): string {
  const document = reader.getContents();
  if (!document) {
    throw new Error('Missing typed-event chapter.');
  }
  selectText(document);
  const selection = reader.interactions.captureSelection();
  if (!selection) {
    throw new Error('Missing typed-event selection.');
  }
  expect(rangeFromCfi(document, selection.cfi).toString()).toBe(selection.text);
  document.getSelection()?.removeAllRanges();
  reader.annotations.mark(selection.cfi, { id: 'typed-note', data: 'original' });
  const button = reader.annotations.element.querySelector('[role="button"]');
  if (!button) {
    throw new Error('Missing typed-event annotation button.');
  }
  click(button);
  return selection.text;
}
