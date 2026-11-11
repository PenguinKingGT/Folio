/** UTF-16 endpoint normalization preserves full Unicode scalars for either visible boundary. */
import { expect, test } from 'vitest';
import { scalarBoundary } from '../../../src/render/visible';

test('expands endpoints around a split surrogate pair and preserves other UTF-16 boundaries', () => {
  expect(scalarBoundary('A😀B', 2, false)).toBe(1);
  expect(scalarBoundary('A😀B', 2, true)).toBe(3);
  expect(scalarBoundary('A😀B', 0, false)).toBe(0);
  expect(scalarBoundary('A😀B', 4, true)).toBe(4);
  expect(scalarBoundary('A😀B', 1, false)).toBe(1);
  expect(scalarBoundary('\uD800A', 1, true)).toBe(1);
});
