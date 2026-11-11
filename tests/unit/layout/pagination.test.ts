/** Pure spread geometry covers exact thresholds, pixel gaps, and invalid dimensions. */
import { expect, test } from 'vitest';
import { computePagination } from '../../../src/index';

test('computes single columns and automatic double-page thresholds', () => {
  expect(computePagination(320, 240)).toMatchObject({
    columnsPerView: 1,
    columnWidth: 320,
    gap: 24,
    advance: 344,
  });
  expect(computePagination(800, 600)).toMatchObject({
    columnsPerView: 2,
    columnWidth: 388,
    advance: 824,
  });
  expect(computePagination(799, 600).columnsPerView).toBe(1);
  expect(computePagination(1000, 600, { spread: 'none' }).columnsPerView).toBe(1);
  expect(computePagination(320, 240, { spread: 'always', gap: 20 })).toMatchObject({
    columnsPerView: 2,
    columnWidth: 150,
    advance: 340,
  });
  expect(computePagination(600, 400, { minSpreadWidth: 600, gap: 0 }).columnWidth).toBe(300);
});

test.each([
  [0, 240],
  [320, 0],
  [-1, 240],
  [Number.NaN, 240],
  [320, Number.POSITIVE_INFINITY],
])('rejects invalid viewport %j x %j', (width, height) => {
  expect(() => computePagination(width, height)).toThrow(RangeError);
});

test.each([
  { gap: -1 },
  { gap: Number.NaN },
  { minSpreadWidth: 0 },
  { minSpreadWidth: Number.POSITIVE_INFINITY },
  { spread: 'always' as const, gap: 320 },
])('rejects invalid settings %j', (options) => {
  expect(() => computePagination(320, 240, options)).toThrow(RangeError);
});

test('rejects unsupported modes from untyped JavaScript callers', () => {
  expect(() => {
    Reflect.apply(computePagination, undefined, [320, 240, { spread: 'invalid' }]);
  }).toThrow(TypeError);
});
