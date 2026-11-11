/** A newer display must invalidate a fixed partner load without waiting for an uncooperative producer. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { fixedFiles } from '../../unit/layout/fixed-fixture';
import { host } from './fixture';

/** Hold the third page response while allowing package and other page requests to complete. */
async function delayedPartner() {
  const files = fixedFiles();
  let begin: (() => void) | undefined;
  let finish: ((response: Response) => void) | undefined;
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const publication = await Book.open('https://original.invalid/OPS/package.opf', {
    fetch: (input) => {
      const url = input instanceof Request ? input.url : input;
      const path = decodeURIComponent(new URL(url).pathname.slice(1));
      if (path === 'OPS/p2.xhtml') {
        begin?.();
        return pending;
      }
      return Promise.resolve(
        new Response(files.get(path) ?? 'missing', { status: files.has(path) ? 200 : 404 }),
      );
    },
  });
  return { publication, started, release: () => finish?.(new Response(files.get('OPS/p2.xhtml'))) };
}

test('cancels pending partner preparation and discards its late completion', async () => {
  const { publication, started, release } = await delayedPartner();
  const container = host();
  const reader = publication.renderTo(container, { spread: 'always' });
  try {
    const older = reader.display(1);
    const rejected = expect(older).rejects.toThrow();
    await started;
    await reader.display(0);
    await rejected;
    release();
    await publication.section(2)?.load();
    expect(reader.currentSection?.index).toBe(0);
    expect(reader.getRenderedPages().map((page) => page.section.index)).toEqual([0]);
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
  } finally {
    release();
    publication.destroy();
    container.remove();
  }
});
