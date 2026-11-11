/** Generation cancellation must preserve prior page tables and reject uncooperative waits promptly. */
import { expect, test } from 'vitest';
import { PageList } from '../../../src/index';
import { cfi, link } from './fixture';

test('cancels per-caller waits and ignores the producer completion', async () => {
  let finish: ((value: string) => void) | undefined;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const pages = new PageList([link('1', 'chapter.xhtml')], () => pending);
  const controller = new AbortController();
  const previous = pages.entries;
  const older = pages.generate({ signal: controller.signal });
  const rejected = expect(older).rejects.toThrow();
  controller.abort();
  await rejected;
  finish?.(cfi(10));
  await pending;
  expect(pages.entries).toBe(previous);
  await expect(pages.generate({ signal: controller.signal })).rejects.toThrow();
});

test('new generation wins and destruction releases data and pending work', async () => {
  let finish: ((value: string) => void) | undefined;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  let calls = 0;
  const pages = new PageList([link('1', 'chapter.xhtml')], () => {
    calls += 1;
    return calls === 1 ? pending : Promise.resolve(cfi(20));
  });
  const older = pages.generate();
  const rejected = expect(older).rejects.toThrow();
  await pages.generate();
  await rejected;
  finish?.(cfi(10));
  await pending;
  expect(pages.cfiFromPage(1)).toBe(cfi(20));
  pages.destroy();
  pages.destroy();
  expect(pages.length).toBe(0);
  expect(() => pages.get(1)).toThrow('destroyed');
  expect(() => pages.at(0)).toThrow('destroyed');
  expect(() => pages.pageFromCfi(cfi(20))).toThrow('destroyed');
  expect(() => pages.pageFromPercentage(0)).toThrow('destroyed');
  await expect(pages.generate()).rejects.toThrow('destroyed');
});

test('destroy cancels a pending resolver without requiring a cooperative producer', async () => {
  let finish: ((value: string) => void) | undefined;
  const pending = new Promise<string>((resolve) => {
    finish = resolve;
  });
  const pages = new PageList([link('1', 'chapter.xhtml')], () => pending);
  const generation = pages.generate();
  const rejected = expect(generation).rejects.toThrow();
  pages.destroy();
  await rejected;
  finish?.(cfi(10));
});
