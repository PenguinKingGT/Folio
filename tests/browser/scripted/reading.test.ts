/** Native opaque sandbox execution supports classic resources, injection order, EPUB identity, and host DOM denial. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { scriptedFiles } from './fixture';
import { host } from '../render/fixture';

/** Expected data is reported by actual publication code after DOM, stylesheet, and identity access. */
const expectedExecution = {
  kind: 'executed',
  order: ['injected-first', 'injected-second', 'inline', 'external'],
  denied: true,
  name: 'Original Host',
  version: '2.0',
  layout: 'scrolling',
  dom: true,
  spine: true,
  unknown: true,
  versionless: true,
  color: 'rgb(1, 2, 3)',
  weight: '700',
  opaque: true,
  frames: 0,
};

test('executes authorized classic scripts and local CSS without sharing the host origin', async () => {
  const book = await Book.open(bookZip(scriptedFiles()));
  const container = host();
  const reader = book.renderScriptedTo(container, {
    scripts: true,
    inject: [
      'window.executionOrder=["injected-first"]',
      'window.executionOrder.push("injected-second")',
    ],
    readingSystem: { name: 'Original Host', version: '2.0' },
  });
  const messages: unknown[] = [];
  const errors: unknown[] = [];
  reader.on('message', (value) => messages.push(value));
  reader.on('error', (error) => errors.push(error));
  try {
    await reader.display();
    expect(messages).toContainEqual(
      expect.objectContaining({
        ...expectedExecution,
      }),
    );
    expect(errors).toEqual([]);
    expect(reader.getContents()).toBeNull();
    expect(reader.frame.contentDocument).toBeNull();
    expect(reader.frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(document.body.hasAttribute('data-publisher-escape')).toBe(false);
    expect(reader.currentSection?.index).toBe(0);
    await reader.display('#scripted');
    reader.destroy();
    reader.destroy();
    expect(container.querySelector('iframe')).toBeNull();
    expect(() => reader.getContents()).toThrow('destroyed');
    await expect(reader.display()).rejects.toThrow('destroyed');
  } finally {
    book.destroy();
    container.remove();
  }
});
