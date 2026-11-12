/** A delayed predecessor cannot bounce a newer upward native scroll back into the previous chapter. */
import { expect, test } from 'vitest';
import { scrollReversal } from './scroll-reversal';

test('retains the last native direction and reading anchor across delayed predecessor measurement', async () => {
  expect(await scrollReversal()).toEqual({
    section: 3,
    retained: true,
    settled: true,
    bounded: true,
    error: false,
  });
});
