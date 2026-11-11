/** Public typography options and physical pagination axes validate before native rendering. */
import { expect, test } from 'vitest';
import { computePagination } from '../../../src/index';
import { WritingLayout } from '../../../src/layout/writing';

test('validates explicit directions and supported writing modes', () => {
  expect(() => new WritingLayout()).not.toThrow();
  expect(() => new WritingLayout({ direction: 'rtl', writingMode: 'vertical-rl' })).not.toThrow();
  for (const options of [{ direction: 'up' }, { writingMode: 'sideways-rl' }]) {
    expect(() => {
      Reflect.construct(WritingLayout, [options]);
    }).toThrow('Unsupported');
  }
});

test('uses the vertical inline extent for column geometry and spread thresholds', () => {
  expect(computePagination(320, 600, { spread: 'always', gap: 20 }, 'vertical')).toMatchObject({
    axis: 'vertical',
    width: 320,
    height: 600,
    columnWidth: 290,
    advance: 620,
  });
  expect(computePagination(1000, 240, {}, 'vertical').columnsPerView).toBe(1);
  expect(computePagination(320, 800, {}, 'vertical').columnsPerView).toBe(2);
  expect(() => {
    Reflect.apply(computePagination, undefined, [320, 240, {}, 'invalid']);
  }).toThrow('axis');
});
