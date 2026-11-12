/** Passive stylesheet parsing has finite byte and recursion bounds before expensive CSS transformation. */
import { expect, test } from 'vitest';
import { resources } from '../resources/fixture';

test('rejects oversized stylesheet bytes before CSS parsing and permits a later retry', async () => {
  let oversized = true;
  const assets = resources({}, () =>
    Promise.resolve(
      new TextEncoder().encode(oversized ? ' '.repeat(1024 * 1024 + 1) : 'p{color:red}'),
    ),
  );
  try {
    await expect(assets.url('styles/main.css')).rejects.toThrow('1 MiB');
    oversized = false;
    expect(await (await fetch(await assets.url('styles/main.css'))).text()).toBe('p{color:red}');
  } finally {
    assets.destroy();
  }
});

test('rejects deep noncyclic dependencies while ordinary assets remain available', async () => {
  let reads = 0;
  const assets = resources({}, () => {
    reads++;
    return Promise.resolve(new TextEncoder().encode(`@import "nested${reads}.css";`));
  });
  try {
    await expect(assets.url('styles/main.css')).rejects.toThrow('supported depth');
    expect(reads).toBe(16);
    expect(await assets.url('font.woff2')).toMatch(/^blob:/);
  } finally {
    assets.destroy();
  }
});
