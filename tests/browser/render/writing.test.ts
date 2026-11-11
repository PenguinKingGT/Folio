/** Real writing-mode tests verify signed scrolling, precise navigation, and native block axes. */
import { afterEach, expect, test } from 'vitest';
import { Book, rangeFromCfi } from '../../../src/index';
import type { RenditionOptions } from '../../../src/index';
import { host } from './fixture';
import { writingBook } from './writing-fixture';
import { bookFiles, bookZip } from '../../unit/book/fixture';

const opened: { publication: Book; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ publication, container }) => {
    publication.destroy();
    container.remove();
  }),
);

/** Bind a book and measurable host to one test lifetime. */
function mount(publication: Book, options: RenditionOptions = {}) {
  const container = host();
  opened.push({ publication, container });
  return publication.renderTo(container, options);
}

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`paginates ${mode} ${direction} using logical reading offsets`, async () => {
      const reader = mount(await writingBook(mode, direction), { spread: 'none' });
      await reader.display();
      const initial = reader.currentLocation();
      const axis = mode === 'horizontal-tb' ? 'horizontal' : 'vertical';
      expect(reader.flowState).toMatchObject({
        axis,
        direction,
        writingMode: mode,
        reverse: direction === 'rtl',
      });
      expect(reader.pagination?.pageCount).toBeGreaterThan(1);
      await reader.next();
      const native =
        axis === 'horizontal'
          ? reader.getContents()?.defaultView?.scrollX
          : reader.getContents()?.defaultView?.scrollY;
      expect(native).toBe((reader.pagination?.advance ?? 0) * (direction === 'rtl' ? -1 : 1));
      expect(reader.currentLocation()?.start.displayed.page).toBe(2);
      await reader.prev();
      expect(reader.currentLocation()?.atStart).toBe(true);
      await reader.display('#end');
      expect(reader.currentLocation()?.atEnd).toBe(true);
      expect(await reader.next()).toBeNull();
      const cfi = initial?.start.cfi ?? '';
      await reader.display(cfi);
      expect(reader.currentLocation()?.start.displayed.page).toBe(1);
      reader.layout({ spread: 'always' });
      expect(reader.pagination?.columnsPerView).toBe(2);
      await reader.display('#end');
      expect(reader.currentLocation()?.atEnd).toBe(true);
    });

    test(`scrolls ${mode} ${direction} along its natural block direction`, async () => {
      const reader = mount(await writingBook(mode, direction), { flow: 'scrolled-doc' });
      await reader.display();
      const axis = mode === 'horizontal-tb' ? 'vertical' : 'horizontal';
      expect(reader.flowState?.axis).toBe(axis);
      expect(reader.flowState?.reverse).toBe(mode === 'vertical-rl');
      await reader.next();
      const contents = reader.getContents();
      const native =
        axis === 'horizontal' ? contents?.defaultView?.scrollX : contents?.defaultView?.scrollY;
      expect(native).toBe((reader.flowState?.viewport ?? 0) * (mode === 'vertical-rl' ? -1 : 1));
      expect(reader.currentLocation()?.start.displayed.page).toBe(2);
      await reader.display('#end');
      expect(reader.currentLocation()?.atEnd).toBe(true);
      reader.flow('scrolled-continuous', mode === 'horizontal-tb' ? 'horizontal' : 'vertical');
      await reader.next();
      expect(reader.currentLocation()?.start.displayed.page).toBe(2);
    });
  }
}

test('respects explicit author directions and reader overrides over OPF defaults', async () => {
  const files = bookFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(
      '<spine ',
      '<spine page-progression-direction="rtl" ',
    ),
  );
  const fallback = mount(await Book.open(bookZip(files)));
  await fallback.display();
  expect(fallback.flowState?.direction).toBe('rtl');
  files.set(
    'OPS/text/chapter one.xhtml',
    (files.get('OPS/text/chapter one.xhtml') ?? '').replace('<html ', '<html dir="ltr" '),
  );
  const author = mount(await Book.open(bookZip(files)));
  await author.display();
  expect(author.flowState?.direction).toBe('ltr');
  const override = mount(await writingBook('vertical-rl', 'rtl'), {
    writingMode: 'horizontal-tb',
    direction: 'ltr',
  });
  await override.display();
  expect(override.flowState).toMatchObject({
    direction: 'ltr',
    writingMode: 'horizontal-tb',
    axis: 'horizontal',
  });
});

test('rejects incompatible pagination axes and unsupported authored sideways modes', async () => {
  const horizontal = mount(await writingBook('horizontal-tb', 'ltr'), { axis: 'vertical' });
  await expect(horizontal.display()).rejects.toThrow('inline axis');
  const publication = await writingBook('horizontal-tb', 'ltr');
  const section = await publication.section()?.load();
  section?.getElementsByTagName('body')[0]?.setAttribute('style', 'writing-mode:sideways-rl');
  const reader = mount(publication);
  await expect(reader.display()).rejects.toThrow('Unsupported authored writing mode');
  const active = mount(await writingBook('horizontal-tb', 'ltr'));
  await active.display();
  const state = active.flowState;
  expect(() => active.flow('paginated', 'vertical')).toThrow('inline axis');
  expect(active.flowState).toBe(state);
});

test('removes owned root declarations when author body styles change writing direction', async () => {
  const reader = mount(await writingBook('vertical-rl', 'rtl'));
  await reader.display('#end');
  const anchor = reader.currentLocation()?.start.cfi ?? '';
  const contents = reader.getContents();
  if (!contents) {
    throw new Error('Missing authored writing document.');
  }
  contents.body.style.writingMode = 'horizontal-tb';
  contents.body.style.direction = 'ltr';
  contents.defaultView?.dispatchEvent(new Event('scroll'));
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  reader.layout();
  expect(reader.flowState).toMatchObject({
    writingMode: 'horizontal-tb',
    direction: 'ltr',
    axis: 'horizontal',
    reverse: false,
  });
  expect(contents.documentElement.style.writingMode).toBe('');
  expect(contents.documentElement.style.direction).toBe('');
  const location = reader.currentLocation();
  if (!location) {
    throw new Error('Missing restored writing location.');
  }
  const point = rangeFromCfi(contents, anchor);
  expect(
    rangeFromCfi(contents, location.start.cfi).compareBoundaryPoints(0, point),
  ).toBeLessThanOrEqual(0);
  expect(
    rangeFromCfi(contents, location.end.cfi).compareBoundaryPoints(0, point),
  ).toBeGreaterThanOrEqual(0);
});

test('preserves a reading CFI across vertical resize and signed flow transitions', async () => {
  const reader = mount(await writingBook('vertical-rl', 'rtl'));
  await reader.display('#end');
  const original = reader.currentLocation()?.start.cfi ?? '';
  const container = reader.frame.parentElement?.parentElement;
  if (!container) {
    throw new Error('Missing reader host.');
  }
  container.style.height = '400px';
  await expect.poll(() => reader.pagination?.height).toBe(400);
  const contents = reader.getContents();
  const location = reader.currentLocation();
  if (!contents || !location) {
    throw new Error('Missing vertical location.');
  }
  const point = rangeFromCfi(contents, original);
  expect(
    rangeFromCfi(contents, location.start.cfi).compareBoundaryPoints(0, point),
  ).toBeLessThanOrEqual(0);
  expect(
    rangeFromCfi(contents, location.end.cfi).compareBoundaryPoints(0, point),
  ).toBeGreaterThanOrEqual(0);
  reader.flow('scrolled-doc');
  expect(reader.currentLocation()?.atStart).toBe(true);
});
