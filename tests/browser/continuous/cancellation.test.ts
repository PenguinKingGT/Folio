/** New display intents and destruction release subscribers without waiting for shared producers. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { host } from '../render/fixture';
import { continuousFiles } from './fixture';

/** Hold a neighbor response while keeping unrelated chapters immediately available. */
async function delayedNeighbor() {
  const files = continuousFiles();
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
      if (path === 'OPS/s1.xhtml') {
        begin?.();
        return pending;
      }
      return Promise.resolve(
        new Response(files.get(path) ?? 'missing', {
          status: files.has(path) ? 200 : 404,
        }),
      );
    },
  });
  return { publication, started, release: () => finish?.(new Response(files.get('OPS/s1.xhtml'))) };
}

test('cancels an obsolete window and ignores its late neighbor without replacing committed frames', async () => {
  const { publication, started, release } = await delayedNeighbor();
  const container = host();
  const reader = publication.renderContinuous(container);
  try {
    const older = reader.display();
    const rejected = expect(older).rejects.toThrow();
    await started;
    const waiting = reader.whenIdle();
    await reader.display(4);
    await rejected;
    await waiting;
    release();
    await publication.section(1)?.load();
    expect(reader.currentSection?.index).toBe(4);
    expect(reader.loadedSections.map((section) => section.index)).toEqual([3, 4, 5]);
    expect(container.querySelectorAll('iframe')).toHaveLength(3);
    expect(reader.lastError).toBeNull();
  } finally {
    release();
    publication.destroy();
    container.remove();
  }
});

test('book destruction releases every reader while neighbor IO remains pending', async () => {
  const { publication, started, release } = await delayedNeighbor();
  const container = host();
  try {
    const reader = publication.renderContinuous(container);
    publication.renderContinuous(container);
    publication.renderTo(container);
    const rejected = expect(reader.display()).rejects.toThrow();
    await started;
    publication.destroy();
    await rejected;
    expect(container.children).toHaveLength(0);
    expect(reader.lastError).toBeNull();
    release();
  } finally {
    release();
    publication.destroy();
    container.remove();
  }
});
