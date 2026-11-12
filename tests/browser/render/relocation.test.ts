/** Observer tests cover queued work, replacement, subscriber mutation, and cleanup. */
import { expect, test } from 'vitest';
import { Relocations } from '../../../src/render/relocation';
import { host, book } from './fixture';

test('cancels pending work and snapshots subscribers during dispatch', async () => {
  const publication = await book();
  const container = host();
  const reader = publication.renderTo(container);
  const observer = new Relocations(() => reader.currentLocation(), window);
  const calls: string[] = [];
  let release: (() => void) | undefined;
  observer.subscribe(() => {
    calls.push('first');
    release?.();
    observer.subscribe(() => calls.push('late'));
  });
  release = observer.subscribe(() => calls.push('second'));
  try {
    observer.report();
    await reader.display();
    const contents = reader.getContents();
    if (contents === null) {
      throw new Error('Missing observer document.');
    }
    observer.watch(contents);
    expect(calls).toEqual(['first', 'second']);
    contents.defaultView?.dispatchEvent(new Event('scroll'));
    contents.defaultView?.dispatchEvent(new Event('scroll'));
    observer.detach();
    observer.report();
    expect(calls).toEqual(['first', 'second']);
    observer.watch(contents);
    expect(calls).toEqual(['first', 'second', 'first', 'late']);
    observer.destroy();
    observer.destroy();
  } finally {
    observer.destroy();
    publication.destroy();
    container.remove();
  }
});

test('unchanged CFI snapshots still notify geometry consumers after native scroll events', async () => {
  const publication = await book();
  const container = host();
  const reader = publication.renderTo(container);
  let changes = 0;
  let geometry = 0;
  await reader.display();
  const location = reader.currentLocation();
  const observer = new Relocations(
    () => location,
    window,
    () => {
      geometry++;
    },
  );
  observer.subscribe(() => {
    changes++;
  });
  try {
    const contents = reader.getContents();
    if (!contents) {
      throw new Error('Missing native chapter.');
    }
    observer.watch(contents);
    expect(changes).toBe(1);
    expect(observer.report()).toBe(false);
    contents.defaultView?.dispatchEvent(new Event('scroll'));
    await expect.poll(() => geometry).toBe(1);
    expect(changes).toBe(1);
  } finally {
    observer.destroy();
    publication.destroy();
    container.remove();
  }
});
