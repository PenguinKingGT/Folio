/** Reproduce inaccessible oversized artwork in native reflowable pagination. */
import { expect, test } from 'vitest';
import { largeMediaScenario } from './large-media';

test('fits oversized artwork on the page reached through its chapter fragment', async () => {
  const result = await largeMediaScenario();
  expect(result.scroll).toBeGreaterThan(0);
  expect(result.width).toBeLessThanOrEqual(320);
  expect(result.height).toBeLessThanOrEqual(240);
  expect(result.left).toBeGreaterThanOrEqual(0);
  expect(result.left + result.width).toBeLessThanOrEqual(320);
  expect(result.top).toBeGreaterThanOrEqual(0);
  expect(result.top + result.height).toBeLessThanOrEqual(240);
  expect(result.attributes).toEqual(['1000', '2000']);
});
