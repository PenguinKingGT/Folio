/** Native location tests verify clipped text endpoints, progress metadata, and relocation lifetime. */
import { afterEach, expect, test } from 'vitest';
import { Cfi, rangeFromCfi } from '../../../src/index';
import type { Book, Rendition, RenditionOptions, VisibleLocation } from '../../../src/index';
import { book, host } from './fixture';
import { navigationBook } from './navigation-fixture';

const opened: { publication: Book; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ publication, container }) => {
    publication.destroy();
    container.remove();
  }),
);

/** Attach a reader to a stable viewport and register cleanup. */
function mount(publication: Book, options: RenditionOptions = {}): Rendition {
  const container = host();
  opened.push({ publication, container });
  return publication.renderTo(container, options);
}

test('reports visible text endpoints, page numbers, and linear publication boundaries', async () => {
  const reader = mount(await navigationBook());
  expect(reader.currentLocation()).toBeNull();
  await reader.display();
  const initial = reader.currentLocation();
  expect(initial?.atStart).toBe(true);
  expect(initial?.atEnd).toBe(false);
  expect(initial?.start.displayed.page).toBe(1);
  expect(initial?.start.displayed.total).toBeGreaterThan(1);
  expect(initial?.start.percentage).toBeNull();
  expect(initial?.start.location).toBeNull();
  await reader.next();
  const next = reader.currentLocation();
  expect(next?.start.displayed.page).toBe(2);
  expect(next?.atStart).toBe(false);
  expect(new Cfi(next?.start.cfi ?? '').compare(new Cfi(initial?.start.cfi ?? ''))).toBeGreaterThan(
    0,
  );
  const contents = reader.getContents();
  if (contents === null || next === null) {
    throw new Error('Missing visible location.');
  }
  const range = rangeFromCfi(contents, next.start.cfi);
  expect(range.startOffset).toBeGreaterThan(0);
  expect(new Cfi(next.start.cfi).compare(new Cfi(next.end.cfi))).toBeLessThan(0);
  const end = rangeFromCfi(contents, next.end.cfi);
  const text = range.startContainer.nodeValue ?? '';
  expect(end.startOffset - range.startOffset).toBeLessThan(text.length);
  await reader.display(2);
  expect(reader.currentLocation()?.atEnd).toBe(true);
  expect(reader.currentLocation()?.atStart).toBe(false);
  reader.destroy();
  expect(() => reader.currentLocation()).toThrow('destroyed');
  expect(() => reader.onRelocated(() => {})).toThrow('destroyed');
});

test('includes generated progress and freezes every published metadata object', async () => {
  const publication = await navigationBook();
  const reader = mount(publication);
  await publication.locations.generate({ breakSize: 10 });
  await reader.display({ percentage: 0.5 });
  const location = reader.currentLocation();
  expect(location?.start.location).toBeGreaterThan(0);
  expect(location?.start.percentage).toBeGreaterThan(0);
  expect(Object.isFrozen(location)).toBe(true);
  expect(Object.isFrozen(location?.start)).toBe(true);
  expect(Object.isFrozen(location?.start.displayed)).toBe(true);
  reader.hide();
  expect(reader.currentLocation()).toEqual(location);
  expect(reader.frame.style.display).toBe('none');
});

test('publishes changed positions, deduplicates commands, and supports unsubscribe', async () => {
  const reader = mount(await navigationBook());
  const events: VisibleLocation[] = [];
  const unsubscribe = reader.onRelocated((location) => events.push(location));
  await reader.display();
  expect(events).toHaveLength(1);
  await reader.display(0);
  expect(events).toHaveLength(1);
  await reader.next();
  expect(events.at(-1)?.start.displayed.page).toBe(2);
  const count = events.length;
  const contents = reader.getContents();
  contents?.defaultView?.scrollTo({
    left: (reader.pagination?.advance ?? 0) * 2,
    behavior: 'instant',
  });
  await expect.poll(() => events.length).toBe(count + 1);
  reader.flow('scrolled-doc');
  expect(events.at(-1)?.start.displayed.page).toBe(1);
  unsubscribe();
  unsubscribe();
  const finalCount = events.length;
  await reader.next();
  expect(events).toHaveLength(finalCount);
});

test('maps scrolled viewports and keeps Unicode endpoints outside surrogate pairs', async () => {
  const publication = await book(
    `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>p{font:16px/20px monospace;margin:0}</style></head><body><p>${'😀 Original text '.repeat(200)}</p><p style="visibility:hidden">Hidden ending</p></body></html>`,
  );
  const reader = mount(publication, { flow: 'scrolled-doc' });
  await reader.display();
  await reader.next();
  const location = reader.currentLocation();
  const contents = reader.getContents();
  if (location === null || contents === null) {
    throw new Error('Missing Unicode location.');
  }
  expect(location.start.displayed.page).toBe(2);
  for (const cfi of [location.start.cfi, location.end.cfi]) {
    const point = rangeFromCfi(contents, cfi);
    const text = point.startContainer.nodeValue ?? '';
    const split = text.slice(point.startOffset - 1, point.startOffset + 1);
    expect(split).not.toMatch(/^[\uD800-\uDBFF][\uDC00-\uDFFF]$/);
  }
  contents.defaultView?.scrollTo({ top: 1_000_000, behavior: 'instant' });
  const final = reader.currentLocation();
  expect(final?.start.displayed.page).toBe(final?.start.displayed.total);
  reader.flow('scrolled-doc', 'horizontal');
  await reader.next();
  expect(reader.currentLocation()?.start.displayed.page).toBe(2);
});

test('provides element CFIs for image-only and empty chapters', async () => {
  for (const content of [
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>',
    '',
  ]) {
    const reader = mount(
      await book(
        `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>${content}</body></html>`,
      ),
    );
    await reader.display();
    const location = reader.currentLocation();
    expect(location?.start.cfi).toBe(location?.end.cfi);
    expect(location?.atStart).toBe(true);
    expect(location?.atEnd).toBe(true);
  }
});

test('includes media surrounding visible text in the start and end boundaries', async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>';
  const reader = mount(
    await book(
      `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>${svg}<p>Between images</p>${svg}</body></html>`,
    ),
  );
  await reader.display();
  const location = reader.currentLocation();
  const contents = reader.getContents();
  if (contents === null || location === null) {
    throw new Error('Missing mixed-content location.');
  }
  expect(rangeFromCfi(contents, location.start.cfi).startContainer).toBe(contents.body.firstChild);
  expect(rangeFromCfi(contents, location.end.cfi).startContainer).toBe(contents.body.lastChild);
});
