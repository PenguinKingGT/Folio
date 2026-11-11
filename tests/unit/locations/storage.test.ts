/** Treat saved progress as untrusted data and verify atomic restoration and publication identity. */
import { expect, test } from 'vitest';
import type { LocationSnapshot } from '../../../src/index';
import { locations } from './fixture';

/** A valid original snapshot with two endpoints belonging to the fixture publication. */
function snapshot(): LocationSnapshot {
  return {
    version: 1,
    identifier: 'original-progress',
    unit: 'characters',
    breakSize: 1,
    total: 10,
    current: 0,
    locations: [
      { cfi: 'epubcfi(/6/2[a]!/4/2/1:0)', position: 0 },
      { cfi: 'epubcfi(/6/2[a]!/4/2/1:10)', position: 10 },
    ],
  };
}

test('restores JSON and structured snapshots, including current progress and empty states', async () => {
  const index = locations();
  await index.generate();
  index.setCurrent(index.length - 1);
  const saved = index.save();
  const restored = locations();
  expect(restored.load(saved)).toEqual(index.entries);
  expect(restored.current).toBe(index.current);
  const zero = {
    ...snapshot(),
    total: 0,
    locations: [{ cfi: 'epubcfi(/6/2[a]!/4)', position: 0 }],
  };
  restored.load(zero);
  expect(restored.percentageFromLocation(0)).toBe(0);
  expect(restored.load({ ...zero, locations: [], current: null })).toEqual([]);
});

test.each([
  null,
  [],
  'invalid JSON',
  {},
  { ...snapshot(), version: 2 },
  { ...snapshot(), identifier: 'other-publication' },
  { ...snapshot(), unit: 'pages' },
  { ...snapshot(), breakSize: 0 },
  { ...snapshot(), total: -1 },
  { ...snapshot(), current: -1 },
  { ...snapshot(), current: null },
  { ...snapshot(), current: 1.5 },
  { ...snapshot(), current: 99 },
  { ...snapshot(), locations: 'not-an-array' },
  { ...snapshot(), locations: [null] },
  { ...snapshot(), locations: [{ cfi: 1, position: 0 }] },
  { ...snapshot(), locations: [{ cfi: 'not-cfi', position: 0 }] },
  { ...snapshot(), locations: [{ cfi: 'epubcfi(/6/2[a]!/4)', position: -1 }] },
  { ...snapshot(), locations: [{ cfi: 'epubcfi(/6/2[a]!/4)', position: 11 }] },
  { ...snapshot(), locations: [{ cfi: 'epubcfi(/6/2[a]!/4)', position: 1 }] },
  { ...snapshot(), locations: [{ cfi: 'epubcfi(/6/100!/4)', position: 0 }] },
  { ...snapshot(), locations: [{ cfi: 'epubcfi(/4/2[a]!/4)', position: 0 }] },
  { ...snapshot(), locations: [{ cfi: 'epubcfi(/6/2[wrong]!/4)', position: 0 }] },
  { ...snapshot(), locations: [{ cfi: 'epubcfi(/6/2[a]!/4/2,/1:0,/1:10)', position: 0 }] },
  { ...snapshot(), locations: [snapshot().locations[1], snapshot().locations[0]] },
  { ...snapshot(), locations: [snapshot().locations[0], snapshot().locations[0]] },
  { ...snapshot(), locations: [] },
  { ...snapshot(), locations: [], total: 0, current: 0 },
  { ...snapshot(), locations: Array.from({ length: 100_001 }, () => null) },
])('rejects malformed saved progress %# without changing the previous index', (data) => {
  const index = locations();
  index.load(snapshot());
  const previous = index.entries;
  expect(() => index.load(data)).toThrow();
  expect(index.entries).toBe(previous);
});

test('caps persisted JSON size and preserves declared snapshots independently', () => {
  const index = locations();
  expect(() => index.load(' '.repeat(10 * 1024 * 1024 + 1))).toThrow(RangeError);
  const data = snapshot();
  index.load(data);
  data.current = 1;
  expect(index.current).toBe(0);
  expect(Object.isFrozen(index.entries[0])).toBe(true);
});

test('rejects saved points inside non-linear chapters', () => {
  const index = locations();
  expect(() =>
    index.load({
      ...snapshot(),
      total: 0,
      locations: [{ cfi: 'epubcfi(/6/4[note]!/4/2/1:0)', position: 0 }],
    }),
  ).toThrow('invalid CFIs');
});
