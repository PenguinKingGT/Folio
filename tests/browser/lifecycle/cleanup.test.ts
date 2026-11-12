/** A throwing trusted extension must not prevent later views, surfaces, hooks, or subscriptions from being released. */
import { expect, test } from 'vitest';
import { Book, Rendition, ContinuousReader, ScriptedReader } from '../../../src/index';
import type { ViewOptions } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles } from '../continuous/fixture';
import { fixedFiles } from '../../unit/layout/fixed-fixture';
import { host } from '../render/fixture';

import { FailingView } from './fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'fixed bounded'} cleanup releases every view after custom destroy throws`, async () => {
    const book = await Book.open(bookZip(continuous ? continuousFiles(4) : fixedFiles()));
    const container = host();
    let destroyed = 0;
    let notifications = 0;
    const createView = (target: HTMLElement, options: ViewOptions) =>
      new FailingView(target, options, () => {
        destroyed += 1;
      });
    const reader = continuous
      ? book.renderContinuous(container, { createView })
      : book.renderTo(container, { createView, spread: 'always' });
    reader.on('destroyed', () => {
      notifications += 1;
    });
    try {
      await reader.display(1);
      const count = container.querySelectorAll('iframe').length;
      expect(count).toBeGreaterThan(1);
      expect(() => reader.destroy()).toThrow(AggregateError);
      expect(destroyed).toBe(count);
      expect(container.children).toHaveLength(0);
      expect(notifications).toBe(1);
      expect(() => reader.on('destroyed', () => {})).toThrow('destroyed');
      reader.destroy();
      expect(destroyed).toBe(count);
      await book.hooks.whenIdle();
    } finally {
      book.destroy();
      container.remove();
    }
  });
}

/** Only the shared destructor/subscription contract is needed to verify all three native owner implementations. */
interface ClosingReader {
  destroy(): void;
  on(event: 'destroyed', listener: () => void): () => void;
}

const factories: readonly ((book: Book, host: HTMLElement, close: () => void) => ClosingReader)[] =
  [
    (book, target, close) => new Rendition(book, target, {}, close),
    (book, target, close) => new ContinuousReader(book, target, {}, close),
    (book, target, close) => new ScriptedReader(book, target, { scripts: true }, close),
  ];

for (const [index, factory] of factories.entries()) {
  test(`native owner ${index} closes public subscriptions even if its destruction callback throws`, async () => {
    const book = await Book.open(bookZip());
    const container = host();
    let ended = 0;
    const reader = factory(book, container, () => {
      throw new Error('Original owner callback');
    });
    reader.on('destroyed', () => {
      ended += 1;
    });
    try {
      expect(() => reader.destroy()).toThrow(AggregateError);
      expect(ended).toBe(1);
      expect(container.children).toHaveLength(0);
      expect(() => reader.on('destroyed', () => {})).toThrow('destroyed');
      reader.destroy();
    } finally {
      book.destroy();
      container.remove();
    }
  });
}
