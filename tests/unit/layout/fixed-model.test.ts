/** Fixed metadata and spread partnering honor physical sides, reading progression, and linearity. */
import { expect, test } from 'vitest';
import { parsePackage, Spine } from '../../../src/index';
import { isFixed, pageSides, renditionValue, spreadPartner } from '../../../src/layout/fixed-model';
import { fixedFiles } from './fixed-fixture';

/** Resolve the original fixture without loading any chapters. */
function model(properties: readonly string[] = [], direction: 'ltr' | 'rtl' = 'ltr') {
  const publication = parsePackage(fixedFiles(properties, direction).get('OPS/package.opf') ?? '');
  const spine = new Spine(publication, () => Promise.resolve(''));
  return { publication, spine, sections: spine.all() };
}

test('defaults to a lone opening page and pairs subsequent opposing slots in either direction', () => {
  for (const direction of ['ltr', 'rtl'] as const) {
    const { publication, spine, sections } = model([], direction);
    const first = spine.get(0);
    const second = spine.get(1);
    const third = spine.get(2);
    if (!first || !second || !third) {
      throw new Error('Missing fixture section.');
    }
    expect(spreadPartner(publication, sections, first)).toBeNull();
    expect(spreadPartner(publication, sections, second)).toBe(third);
    expect(spreadPartner(publication, sections, third)).toBe(second);
    expect(pageSides(publication, sections).get(0)).toBe(direction === 'ltr' ? 'right' : 'left');
  }
});

test('honors item layout overrides, legacy side properties and centered-page boundaries', () => {
  const { publication, spine, sections } = model([
    'rendition:page-spread-center',
    'page-spread-left',
    'rendition:layout-reflowable',
    'rendition:layout-pre-paginated',
  ]);
  const first = spine.get(0);
  const second = spine.get(1);
  const third = spine.get(2);
  if (!first || !second || !third) {
    throw new Error('Missing fixture section.');
  }
  expect(pageSides(publication, sections).get(0)).toBe('center');
  expect(spreadPartner(publication, sections, first)).toBeNull();
  expect(spreadPartner(publication, sections, second)).toBeNull();
  expect(isFixed(publication, third)).toBe(false);
  expect(renditionValue(publication, first, 'orientation', 'auto')).toBe('auto');
});

test('does not pair non-linear entries or contradictory physical sides', () => {
  const files = fixedFiles(['', 'page-spread-left', 'page-spread-left']);
  const publication = parsePackage(
    (files.get('OPS/package.opf') ?? '').replace('idref="p3"', 'idref="p3" linear="no"'),
  );
  const spine = new Spine(publication, () => Promise.resolve(''));
  for (const section of spine.all()) {
    expect(spreadPartner(publication, spine.all(), section)).toBeNull();
  }
});
