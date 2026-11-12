/** Reported relative font sizes must leave backward chapter transitions on the actual final page. */
import { expect, test } from 'vitest';
import { navigationBook } from '../render/navigation-fixture';
import { fontBoundary } from './font-boundary';

for (const size of ['80%', '120%'] as const) {
  test(`previous chapter reaches its last page after changing font size to ${size}`, async () => {
    const result = await fontBoundary(await navigationBook(), size);
    expect(result.font).toBeCloseTo(size === '80%' ? 12.8 : 19.2, 1);
    expect(result.previous).toBe(0);
    expect(result.finalVisible).toBe(true);
    expect(result.next).toBe(2);
  });
}
