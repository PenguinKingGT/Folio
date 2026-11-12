/** Script isolation is verified against actual background execution and unsupported foreign script namespaces. */
import { expect, test } from 'vitest';
import { prepareContent } from '../../../src/render/content';
import { book, host } from '../render/fixture';
import { workerScenario } from './workers';

test('explicit scripts remain isolated from background workers', async () => {
  expect(await workerScenario(await book())).toEqual({ worker: 'blocked' });
});

test('foreign SVG scripts are rejected explicitly and do not silently change execution semantics', async () => {
  const publication = await book(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><svg xmlns="http://www.w3.org/2000/svg"><script>throw new Error("foreign")</script></svg></body></html>',
  );
  const container = host();
  try {
    const reader = publication.renderScriptedTo(container, { scripts: true });
    await expect(reader.display()).rejects.toThrow('only XHTML script');
    expect(reader.frame.srcdoc).toBe('<!DOCTYPE html><title>Inactive EPUB view</title>');
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('native content parsing rejects entity declarations before DOM expansion', () => {
  expect(() =>
    prepareContent(
      '<!DOCTYPE html [<!ENTITY bomb "expanded">]><html xmlns="http://www.w3.org/1999/xhtml"><head/><body>&bomb;</body></html>',
      'unsafe',
    ),
  ).toThrow('DTD');
});
