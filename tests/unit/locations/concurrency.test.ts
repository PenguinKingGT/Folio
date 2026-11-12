/** Upstream #1405: location generation overlaps bounded chapter I/O while committing samples in linear spine order. */
import { expect, test } from 'vitest';
import { Cfi, Locations } from '../../../src/index';
import { chapter, publication } from './fixture';
import { deferred, nextTurn } from '../lifecycle/fixture';

test('starts both linear chapter loads before the first completes and retains reading order after reverse completion', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const calls: string[] = [];
  const index = new Locations(publication(), (href) => {
    calls.push(href);
    return href === 'a.xhtml' ? first.promise : second.promise;
  });
  const options = { breakSize: 3, concurrency: 2 };
  const operation = index.generate(options);
  try {
    await nextTurn();
    expect(calls).toEqual(['a.xhtml', 'b.xhtml']);
    second.resolve(chapter('<p>Second chapter text.</p>'));
    await nextTurn();
    expect(index.entries).toHaveLength(0);
    first.resolve(chapter('<p>First chapter text.</p>'));
    const entries = await operation;
    expect(entries.length).toBeGreaterThan(2);
    for (let offset = 1; offset < entries.length; offset++) {
      expect(
        new Cfi(entries[offset - 1]?.cfi ?? '').compare(entries[offset]?.cfi ?? ''),
      ).toBeLessThanOrEqual(0);
    }
    expect(new Cfi(entries[0]?.cfi ?? '').spineIndex).toBe(0);
    expect(new Cfi(entries.at(-1)?.cfi ?? '').spineIndex).toBe(2);
  } finally {
    first.resolve(chapter('<p>First chapter text.</p>'));
    second.resolve(chapter('<p>Second chapter text.</p>'));
    await operation;
    index.destroy();
  }
});
