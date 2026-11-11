/** Verify real viewport navigation, exact destinations, chapter boundaries, and reuse. */
import { afterEach, expect, test } from 'vitest';
import { cfiFromNode, cfiFromRange } from '../../../src/index';
import type { Book, Rendition, RenditionOptions } from '../../../src/index';
import { host } from './fixture';
import { navigationBook } from './navigation-fixture';

const opened: { book: Book; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ book, container }) => {
    book.destroy();
    container.remove();
  }),
);

/** Create a measurable attached reader and register cleanup. */
async function reader(options: RenditionOptions = {}): Promise<Rendition> {
  const book = await navigationBook();
  const container = host();
  opened.push({ book, container });
  return book.renderTo(container, options);
}

test('moves page by page and crosses linear chapters in both directions', async () => {
  const view = await reader();
  expect((await view.next())?.index).toBe(0);
  const contents = view.getContents();
  expect(await view.prev()).toBeNull();
  await view.next();
  expect(contents?.defaultView?.scrollX).toBe(view.pagination?.advance);
  await view.prev();
  expect(contents?.defaultView?.scrollX).toBe(0);
  await view.display('#end');
  expect(view.getContents()).toBe(contents);
  expect((await view.next())?.index).toBe(2);
  expect(await view.next()).toBeNull();
  expect((await view.prev())?.index).toBe(0);
  expect(view.getContents()?.defaultView?.scrollX).toBe(
    (view.pagination?.pageCount ?? 1) * (view.pagination?.advance ?? 0) -
      (view.pagination?.advance ?? 0),
  );
  await view.display('#chapter');
  expect(view.getContents()?.defaultView?.scrollX).toBe(0);
});

test('seeks text and element CFIs, named anchors, and percentage samples', async () => {
  const view = await reader();
  await view.display();
  const contents = view.getContents();
  const end = contents?.getElementById('end');
  if (contents === null || end === null || end === undefined || end.firstChild === null) {
    throw new Error('Missing original destination.');
  }
  const base = '/6/2[chapter]';
  const cfi = cfiFromNode(end, { base }).toString();
  await view.display(cfi);
  expect(contents.defaultView?.scrollX).toBeGreaterThan(0);
  const offset = contents.defaultView?.scrollX;
  await view.display(0);
  const range = contents.createRange();
  range.selectNodeContents(end);
  await view.display(cfiFromRange(range, { base }).toString());
  expect(contents.defaultView?.scrollX).toBe(offset);
  await view.display({ href: '../text/chapter%20one.xhtml#legacy', from: 'OPS/nav/toc.xhtml' });
  expect(contents.defaultView?.scrollX).toBeGreaterThan(0);
  await view.display({ percentage: 1 });
  expect(view.currentSection?.index).toBe(2);
  await view.display({ percentage: 0 });
  expect(view.currentSection?.index).toBe(0);
  await expect(view.display('#missing')).rejects.toThrow('anchor not found');
});

test('scrolls by viewport on either axis and clamps the last partial viewport', async () => {
  const view = await reader({ flow: 'scrolled-doc' });
  await view.display();
  const contents = view.getContents();
  await view.next();
  expect(contents?.defaultView?.scrollY).toBe(240);
  await view.prev();
  expect(contents?.defaultView?.scrollY).toBe(0);
  await view.display('#end');
  expect(contents?.defaultView?.scrollY).toBeGreaterThan(0);
  view.flow('scrolled-doc', 'horizontal');
  await view.next();
  expect(contents?.defaultView?.scrollX).toBe(320);
  await view.display('#empty');
  expect(contents?.defaultView?.scrollX).toBeGreaterThan(0);
  expect((await view.next())?.index).toBe(2);
  await view.prev();
  expect(view.getContents()?.defaultView?.scrollX).toBeGreaterThan(0);
  view.destroy();
  await expect(view.next()).rejects.toThrow('destroyed');
  await expect(view.prev()).rejects.toThrow('destroyed');
});

test('positions hidden readers without revealing their content', async () => {
  const view = await reader();
  view.hide();
  await view.display('text/chapter%20one.xhtml#end');
  expect(view.frame.hidden).toBe(true);
  expect(view.frame.style.display).toBe('none');
  view.show();
  expect(view.getContents()?.defaultView?.scrollX).toBeGreaterThan(0);
  view.hide();
  await view.prev();
  expect(view.frame.style.display).toBe('none');
  view.show();
  const offset = view.getContents()?.defaultView?.scrollX ?? 0;
  expect(offset).toBeGreaterThan(0);
  await view.next();
  expect(view.getContents()?.defaultView?.scrollX).toBeGreaterThan(offset);
});
