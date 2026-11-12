/** Script permission requires exact opt-in and immutable bounded injection/identity settings before frame allocation. */
import { expect, test } from 'vitest';
import { scriptedSettings } from '../../../src/scripted/options';
import { Book } from '../../../src/index';
import { bookZip } from '../book/fixture';

test('snapshots injection and reading-system identity while keeping popups independently disabled', () => {
  const inject = ['first', 'second'];
  const options = {
    scripts: true,
    inject,
    readingSystem: { name: 'Original Reader', version: '2.0' },
  } satisfies Parameters<typeof scriptedSettings>[0];
  const settings = scriptedSettings(options);
  inject.push('late');
  options.readingSystem.name = 'changed';
  expect(settings.inject).toEqual(['first', 'second']);
  expect(Object.isFrozen(settings.inject)).toBe(true);
  expect(settings.name).toBe('Original Reader');
  expect(settings.version).toBe('2.0');
  expect(settings.popups).toBe(false);
  expect(scriptedSettings({ scripts: true, popups: true }).popups).toBe(true);
  expect(scriptedSettings({ scripts: true }).name).toBe('Folio');
});

test('rejects absent, truthy, malformed, and oversized permissions/configuration', () => {
  for (const options of [
    undefined,
    null,
    {},
    { scripts: false },
    { scripts: 'true' },
    { scripts: true, popups: 'yes' },
    { scripts: true, inject: null },
    { scripts: true, inject: [1] },
    { scripts: true, inject: Array.from({ length: 17 }, () => '') },
    { scripts: true, inject: ['x'.repeat(262_145)] },
    { scripts: true, readingSystem: null },
    { scripts: true, readingSystem: { name: '', version: '1' } },
    { scripts: true, readingSystem: { name: 'Original', version: 'x'.repeat(129) } },
    ...[0, -1, 1.5, NaN, null, 129 * 1024 * 1024].map((maxResourceBytes) => ({
      scripts: true,
      maxResourceBytes,
    })),
  ]) {
    expect(() => {
      Reflect.apply(scriptedSettings, null, [options]);
    }).toThrow();
  }
});

test('public scripted reader opt-in fails before DOM access or chapter I/O even in a headless process', async () => {
  const book = await Book.open(bookZip());
  let read = 0;
  book.on('resourceLoaded', () => {
    read += 1;
  });
  try {
    for (const scripts of [undefined, false, 'yes', 1]) {
      expect(() => {
        Reflect.apply(book.renderScriptedTo.bind(book), book, ['#headless', { scripts }]);
      }).toThrow('scripts: true');
    }
    expect(read).toBe(0);
  } finally {
    book.destroy();
  }
});
