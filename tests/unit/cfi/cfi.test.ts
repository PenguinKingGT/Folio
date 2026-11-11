/** Original CFI examples verify structural operations independently of a DOM implementation. */
import { expect, test } from 'vitest';
import { Cfi, escapeCfi } from '../../../src/index';

test.each([
  'epubcfi(/6/2[chapter]!/4/2/1:0)',
  'epubcfi(/6/10!/4/2/1:123[before,after;s=b])',
  'epubcfi(/6/2!/4/2,/1:0,/1:10)',
  'epubcfi(/6/2!/4/2/1,:0,:10)',
  'epubcfi(/6/2!/4/2!/2/1:3)',
  'epubcfi(/2/4)',
])('round trips %s', (source) => {
  expect(new Cfi(source).toString()).toBe(source);
  expect(new Cfi(`#${source}`).toString()).toBe(source);
});

test('extracts spine positions and escaped itemref identifiers', () => {
  expect(new Cfi('epubcfi(/6/10[chapter;s=a]!/4)').spineIndex).toBe(4);
  expect(new Cfi('epubcfi(/6/10[chapter;s=a]!/4)').spineId).toBe('chapter');
  expect(new Cfi('epubcfi(/6/2!/4)').spineId).toBeNull();
  expect(new Cfi('epubcfi(/2/4)').spineIndex).toBeNull();
  expect(new Cfi('epubcfi(/6!/4)').spineIndex).toBeNull();
  expect(new Cfi('epubcfi(/6/3!/4)').spineIndex).toBeNull();
  expect(new Cfi('epubcfi(/2/4)').spineId).toBeNull();
  const literal = 'chapter^[,];=(part)';
  expect(new Cfi(`epubcfi(/6/2[${escapeCfi(literal)}]!/4)`).spineId).toBe(literal);
});

test('collapses ranges into independent points without losing assertions or zero offsets', () => {
  const range = new Cfi('epubcfi(/6/2[chapter]!/4/2,/1:0[before,after],/3:5)');
  expect(range.isRange).toBe(true);
  expect(range.collapse().toString()).toBe('epubcfi(/6/2[chapter]!/4/2/1:0[before,after])');
  expect(range.collapse(false).toString()).toBe('epubcfi(/6/2[chapter]!/4/2/3:5)');
  expect(range.isRange).toBe(true);
  const point = range.collapse();
  expect(point.isRange).toBe(false);
  expect(point.collapse().toString()).toBe(point.toString());
});

test('freezes parsed data so external JavaScript cannot change validated structure', () => {
  const cfi = new Cfi('epubcfi(/6/2!/4/2/1,:0,:5)');
  expect(Object.isFrozen(cfi.data)).toBe(true);
  expect(Object.isFrozen(cfi.data.paths)).toBe(true);
  expect(Object.isFrozen(cfi.data.range?.start)).toBe(true);
  expect(Reflect.set(cfi.data, 'range', null)).toBe(false);
});
