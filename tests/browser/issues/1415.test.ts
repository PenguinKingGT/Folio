/** Upstream #1415: fully selected middle paragraphs must retain an underline on each visible text line. */
import { expect, test } from 'vitest';
import { paragraphUnderline } from './paragraph-underline';

test('underlines individual lines of a fully selected middle paragraph', async () => {
  const result = await paragraphUnderline();
  expect(result.expected).toBeGreaterThan(1);
  expect(result.matched).toBe(result.expected);
  expect(result.error).toBe(false);
});

test('tight line spacing does not merge equal-width neighboring text lines into one underline', async () => {
  const result = await paragraphUnderline(12);
  expect(result.expected).toBeGreaterThan(1);
  expect(result.matched).toBe(result.expected);
  expect(result.error).toBe(false);
});
