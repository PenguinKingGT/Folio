/** Fixed viewport parsing and gapless synthetic spread geometry remain independent of browser layout. */
import { expect, test } from 'vitest';
import { fixedGeometry, parseViewport } from '../../../src/index';

test('reads numeric viewport dimensions and ignores unrelated viewport parameters', () => {
  expect(parseViewport('WIDTH = 600; height=800, initial-scale=1, malformed')).toEqual({
    width: 600,
    height: 800,
  });
  expect(parseViewport('width=.5,height=1.5')).toEqual({ width: 0.5, height: 1.5 });
  for (const source of [
    '',
    'width=0,height=800',
    'width=600,height=-1',
    'width=600',
    'width=device-width,height=800',
    'width=0x100,height=800',
    `width=${'9'.repeat(400)},height=800`,
  ]) {
    expect(() => parseViewport(source)).toThrow('viewport');
  }
});

test('centers single pages and joins facing slots at a common spine without a gutter', () => {
  const viewport = { width: 600, height: 800 };
  expect(fixedGeometry(viewport, 1000, 600, 'center', true)).toMatchObject({
    scale: 0.75,
    x: 275,
    y: 0,
    spread: false,
  });
  const left = fixedGeometry(viewport, 1200, 1000, 'left', true);
  const right = fixedGeometry(viewport, 1200, 1000, 'right', true);
  expect(left.x + left.width * left.scale).toBe(right.x);
  expect(right.scale).toBe(1);
  expect(right.y).toBe(100);
  expect(fixedGeometry(viewport, 1200, 1000, 'left', false).x).toBe(225);
  expect(fixedGeometry(viewport, 1200, 1000, 'left', true, 0.5).x).toBe(300);
});

test('rejects invalid reader dimensions, authored dimensions, and non-fitting scales', () => {
  const viewport = { width: 600, height: 800 };
  for (const [width, height] of [
    [0, 10],
    [10, 0],
    [NaN, 10],
    [10, Infinity],
    [-1, 10],
  ]) {
    expect(() => fixedGeometry(viewport, width ?? 0, height ?? 0, 'left', true)).toThrow(
      RangeError,
    );
  }
  for (const intrinsic of [
    { width: 0, height: 800 },
    { width: 600, height: -1 },
    { width: NaN, height: 800 },
    { width: 600, height: Infinity },
  ]) {
    expect(() => fixedGeometry(intrinsic, 1200, 800, 'right', true)).toThrow('Intrinsic');
  }
  for (const scale of [0, -1, NaN, Infinity, 2]) {
    expect(() => fixedGeometry(viewport, 1200, 800, 'left', true, scale)).toThrow('scale');
  }
  expect(() => {
    Reflect.apply(fixedGeometry, undefined, [viewport, 1200, 800, 'invalid', true]);
  }).toThrow('side');
});
