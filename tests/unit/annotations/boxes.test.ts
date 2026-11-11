/** Annotation geometry clips unsupported rectangles and merges duplicate glyph fragments without bridging line gaps. */
import { expect, test } from 'vitest';
import { clipBox, mergeBoxes } from '../../../src/annotations/boxes';

test('clips visible fragments and rejects empty/non-finite geometry', () => {
  expect(clipBox({ x: -5, y: -4, width: 20, height: 20 }, 10, 10)).toEqual({
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  expect(clipBox({ x: 2, y: 3, width: 4, height: 5 }, 20, 20)).toEqual({
    x: 2,
    y: 3,
    width: 4,
    height: 5,
  });
  for (const box of [
    { x: 20, y: 0, width: 2, height: 2 },
    { x: 0, y: 20, width: 2, height: 2 },
    { x: 0, y: 0, width: 0, height: 1 },
    { x: NaN, y: 0, width: 1, height: 1 },
  ]) {
    expect(clipBox(box, 10, 10)).toBeNull();
  }
});

test('merges overlapping horizontal/vertical fragments and keeps separate rows and columns', () => {
  expect(
    mergeBoxes([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
      { x: 0, y: 0, width: 10, height: 10 },
    ]),
  ).toEqual([{ x: 0, y: 0, width: 20, height: 10 }]);
  expect(
    mergeBoxes([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 0, y: 10, width: 10, height: 10 },
    ]),
  ).toEqual([{ x: 0, y: 0, width: 10, height: 20 }]);
  for (const boxes of [
    [
      { x: 0, y: 0, width: 20, height: 20 },
      { x: 2, y: 3, width: 4, height: 5 },
    ],
    [
      { x: 2, y: 3, width: 4, height: 5 },
      { x: 0, y: 0, width: 20, height: 20 },
    ],
  ]) {
    expect(mergeBoxes(boxes)).toEqual([{ x: 0, y: 0, width: 20, height: 20 }]);
  }
  const separate = [
    { x: 0, y: 0, width: 10, height: 10 },
    { x: 0, y: 30, width: 10, height: 10 },
    { x: 30, y: 0, width: 10, height: 10 },
  ];
  expect(mergeBoxes(separate)).toEqual(separate);
  expect(mergeBoxes([])).toEqual([]);
  expect(() =>
    mergeBoxes(
      Array.from({ length: 1025 }, () => separate[0] ?? { x: 0, y: 0, width: 1, height: 1 }),
    ),
  ).toThrow('fragments');
});
