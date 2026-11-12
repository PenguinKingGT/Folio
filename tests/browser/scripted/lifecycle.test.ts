/** Executable reader lifecycle keeps navigation explicit and cancels stale host work without leaking frame sessions. */
import { expect, test } from 'vitest';
import { Book, ScriptedReader } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { scriptedFiles } from './fixture';
import { host } from '../render/fixture';
import { gate } from '../../unit/extensions/fixture';

test('chapter turns, boundary nulls and failed targets retain typed errors and consistent destruction', async () => {
  const book = await Book.open(bookZip(scriptedFiles()));
  const container = host();
  const reader = new ScriptedReader(book, container, { scripts: true });
  const errors: unknown[] = [];
  reader.on('error', (error) => errors.push(error));
  try {
    expect((await reader.next())?.index).toBe(0);
    expect(await reader.prev()).toBeNull();
    expect((await reader.next())?.index).toBe(1);
    expect((await reader.prev())?.index).toBe(0);
    await reader.display(3);
    expect(await reader.next()).toBeNull();
    for (const target of [{ percentage: 0.5 }, 'epubcfi(/6/2!/4/2/1:0)', 'missing.xhtml']) {
      const operation: unknown = Reflect.apply(reader.display.bind(reader), reader, [target]);
      await expect(operation).rejects.toThrow();
    }
    expect(errors).toHaveLength(3);
    expect(reader.lastError).toBe(errors[2]);
    expect(reader.currentSection).toBeNull();
    await reader.display(0);
    expect(reader.lastError).toBeNull();
    reader.destroy();
    reader.destroy();
    await expect(reader.next()).rejects.toThrow('destroyed');
    await expect(reader.prev()).rejects.toThrow('destroyed');
    expect(() => reader.getContents()).toThrow('destroyed');
  } finally {
    reader.destroy();
    book.destroy();
    container.remove();
  }
});

for (const destroy of [false, true]) {
  test(`${destroy ? 'destruction' : 'supersession'} promptly cancels uncooperative serialization without late display notifications`, async () => {
    const book = await Book.open(bookZip(scriptedFiles()));
    const container = host();
    const reader = book.renderScriptedTo(container, { scripts: true });
    const started = gate();
    const waiting = gate();
    book.hooks.serialize.register(async ({ section }) => {
      if (section.index === 0) {
        started.release();
        await waiting.promise;
      }
    });
    const displayed: number[] = [];
    const errors: unknown[] = [];
    reader.on('displayed', (section) => displayed.push(section.index));
    reader.on('error', (error) => errors.push(error));
    const rejected = expect(reader.display(0)).rejects.toThrow();
    try {
      await started.promise;
      if (destroy) {
        book.destroy();
      } else {
        expect((await reader.display(2)).index).toBe(2);
      }
      await rejected;
      waiting.release();
      expect(displayed).toEqual(destroy ? [] : [2]);
      expect(errors).toEqual([]);
      if (destroy) {
        expect(container.querySelector('iframe')).toBeNull();
      }
    } finally {
      waiting.release();
      book.destroy();
      container.remove();
    }
  });
}

test('producer AbortError remains expected control flow without an operational error notification', async () => {
  const book = await Book.open(bookZip(scriptedFiles()));
  const container = host();
  const reader = book.renderScriptedTo(container, { scripts: true });
  book.hooks.serialize.register(() => {
    throw new DOMException('producer cancelled', 'AbortError');
  });
  const errors: unknown[] = [];
  reader.on('error', (error) => errors.push(error));
  try {
    await expect(reader.display()).rejects.toThrow('cancelled');
    expect(errors).toEqual([]);
    expect(reader.lastError).toBeNull();
  } finally {
    book.destroy();
    container.remove();
  }
});
