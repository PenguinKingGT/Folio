/** Swipe classification distinguishes logical direction, physical axes, and deliberate non-navigation gestures. */
import { expect, test } from 'vitest';
import { Swipe } from '../../../src/touch/swipe';
import { touchOptions } from '../../../src/touch/options';

const settings = { minDistance: 32, maxDurationMs: 800, axisRatio: 1.5 };

for (const axis of ['horizontal', 'vertical'] as const) {
  for (const reverse of [false, true]) {
    test(`maps ${axis} reversed=${reverse} swipes to logical page turns including a zero start coordinate`, () => {
      const start = { x: 0, y: 0, time: 0 };
      const forward =
        axis === 'horizontal' ? { x: -50, y: 4, time: 200 } : { x: 4, y: -50, time: 200 };
      expect(new Swipe(start, axis, reverse, settings).end(forward)).toBe(reverse ? -1 : 1);
      expect(
        new Swipe(start, axis, reverse, settings).end({ ...forward, x: -forward.x, y: -forward.y }),
      ).toBe(reverse ? 1 : -1);
    });
  }
}

test('rejects short, diagonal, slow and non-monotonic timestamp gestures', () => {
  const start = { x: 0, y: 0, time: 100 };
  for (const point of [
    { x: -10, y: 0, time: 200 },
    { x: -30, y: 0, time: 200 },
    { x: -50, y: 40, time: 200 },
    { x: -50, y: 0, time: 901 },
    { x: -50, y: 0, time: 99 },
  ]) {
    expect(new Swipe(start, 'horizontal', false, settings).end(point)).toBe(0);
  }
  const cancelled = new Swipe(start, 'horizontal', false, settings);
  expect(cancelled.move({ x: 0, y: 20, time: 150 })).toBe(false);
  expect(cancelled.end({ x: -100, y: 20, time: 200 })).toBe(0);
});

test('validates touch settings and keeps immutable default copies', () => {
  expect(touchOptions(undefined)).toBeNull();
  expect(touchOptions(false)).toBeNull();
  expect(touchOptions(true)).toEqual(settings);
  expect(Object.isFrozen(touchOptions({ minDistance: 40, axisRatio: 2 }))).toBe(true);
  for (const options of [{ minDistance: 0 }, { maxDurationMs: NaN }, { axisRatio: 0.9 }]) {
    expect(() => touchOptions(options)).toThrow(RangeError);
  }
  for (const value of [null, [], 'yes', 1]) {
    expect(() => {
      Reflect.apply(touchOptions, undefined, [value]);
    }).toThrow(TypeError);
  }
});
