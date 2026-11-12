/** Validate reversible native column-media defaults without overriding publisher or host typography. */
import { afterEach, expect, test } from 'vitest';
import { Book, cfiFromNode } from '../../../src/index';
import type { Rendition } from '../../../src/index';
import { book, host } from './fixture';
import { largeArtwork, largeMediaChapter } from '../issues/large-media';
import { fixedFiles } from '../../unit/layout/fixed-fixture';
import { bookZip } from '../../unit/book/fixture';

const mounted: { publication: Book; container: HTMLElement }[] = [];

/** Release native views and all book resources, including after a failed assertion. */
afterEach(() => {
  for (const { publication, container } of mounted.splice(0)) {
    publication.destroy();
    container.remove();
  }
});

/** Load a stable single-page reader and retain cleanup ownership for each assertion scenario. */
async function mount(markup = largeMediaChapter()): Promise<Rendition> {
  const publication = await book(markup);
  const container = host();
  mounted.push({ publication, container });
  const reader = publication.renderTo(container, { spread: 'none', gap: 0 });
  await reader.display();
  return reader;
}

/** Require an actual native image rather than manufacturing fallback geometry. */
function image(reader: Rendition): HTMLImageElement {
  const element = reader.getContents()?.querySelector('img');
  if (!element) {
    throw new Error('Missing original artwork.');
  }
  return element;
}

test('updates column caps for spreads and resize without accumulating styles or changing CFI paths', async () => {
  const reader = await mount();
  const artwork = image(reader);
  const original = cfiFromNode(artwork, { base: '/6/2[chapter]' }).toString();
  const content = artwork.ownerDocument;
  expect(artwork.getBoundingClientRect().height).toBe(240);
  expect(content.defaultView?.getComputedStyle(artwork).objectFit).toBe('contain');
  expect(reader.layout({ spread: 'always', gap: 20 })?.columnWidth).toBe(150);
  expect(artwork.getBoundingClientRect().width).toBe(150);
  reader.frame.style.width = '200px';
  reader.frame.style.height = '150px';
  reader.layout({ spread: 'none' });
  expect(artwork.getBoundingClientRect().width).toBe(200);
  expect(artwork.getBoundingClientRect().height).toBe(150);
  reader.layout();
  expect(content.querySelectorAll('[data-folio-column-media]')).toHaveLength(1);
  expect(cfiFromNode(artwork, { base: '/6/2[chapter]' }).toString()).toBe(original);
  content.querySelector('[data-folio-column-media]')?.remove();
  reader.layout();
  expect(content.querySelectorAll('[data-folio-column-media]')).toHaveLength(1);
});

test('recovers original image dimensions and author markup when switching to natural scrolling', async () => {
  const reader = await mount();
  const artwork = image(reader);
  const content = artwork.ownerDocument;
  const markup = content.body.innerHTML;
  reader.flow('scrolled-doc');
  expect(artwork.getBoundingClientRect().width).toBe(1000);
  expect(artwork.getBoundingClientRect().height).toBe(2000);
  expect(content.querySelector('[data-folio-column-media]')).toBeNull();
  reader.flow('scrolled-doc', 'horizontal');
  expect(artwork.getBoundingClientRect().width).toBe(320);
  expect(artwork.getBoundingClientRect().height).toBe(240);
  reader.flow('paginated');
  reader.flow('scrolled-doc');
  expect(content.querySelector('[data-folio-column-media]')).toBeNull();
  expect(content.body.innerHTML).toBe(markup);
});

test('preserves explicit author limits, priorities, fitting, and host theme overrides', async () => {
  const reader = await mount(
    largeMediaChapter().replace(
      'img{display:block}',
      'img{display:block;max-width:80px;object-fit:cover;vertical-align:bottom}img{max-height:60px!important}',
    ),
  );
  const artwork = image(reader);
  const style = artwork.ownerDocument.defaultView?.getComputedStyle(artwork);
  expect(artwork.getBoundingClientRect().width).toBe(80);
  expect(artwork.getBoundingClientRect().height).toBe(60);
  expect(style?.objectFit).toBe('cover');
  expect(style?.verticalAlign).toBe('bottom');
  await reader.themes.registerCss('default', 'img{max-width:40px}');
  expect(artwork.getBoundingClientRect().width).toBe(40);
  reader.flow('scrolled-doc');
  expect(artwork.getBoundingClientRect().width).toBe(40);
  expect(artwork.getBoundingClientRect().height).toBe(60);
});

test('leaves intrinsic small media and nested SVG viewports intact while fitting outer artwork', async () => {
  const tiny =
    'data:image/svg+xml,' +
    encodeURIComponent(
      largeArtwork.replace('width="1000" height="2000"', 'width="10" height="20"'),
    );
  const reader = await mount(
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><img src="${tiny}"/><svg xmlns="http://www.w3.org/2000/svg" width="1000" height="2000" viewBox="0 0 1000 2000"><svg id="nested" width="400" height="500"/></svg></body></html>`,
  );
  const artwork = image(reader);
  await artwork.decode();
  expect(artwork.getBoundingClientRect().width).toBe(10);
  expect(artwork.getBoundingClientRect().height).toBe(20);
  const content = artwork.ownerDocument;
  const outer = content.querySelector('body > svg');
  const nested = content.getElementById('nested');
  expect(outer?.getBoundingClientRect().width).toBeLessThanOrEqual(320);
  expect(outer?.getBoundingClientRect().height).toBeLessThanOrEqual(240);
  if (!nested) {
    throw new Error('Missing nested SVG viewport.');
  }
  expect(content.defaultView?.getComputedStyle(nested).maxWidth).toBe('none');
  expect(nested.getAttribute('width')).toBe('400');
});

test('keeps fixed-layout image dimensions under the authored containing block', async () => {
  const files = fixedFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    largeMediaChapter().replace(
      '<head>',
      '<head><meta name="viewport" content="width=600,height=800"/>',
    ),
  );
  const publication = await Book.open(bookZip(files));
  const container = host();
  mounted.push({ publication, container });
  const reader = publication.renderTo(container, { spread: 'none' });
  await reader.display();
  expect(reader.fixedLayout).not.toBeNull();
  expect(image(reader).getBoundingClientRect().width).toBe(1000);
  expect(image(reader).getBoundingClientRect().height).toBe(2000);
  expect(reader.getContents()?.querySelector('[data-folio-column-media]')).toBeNull();
});

for (const writingMode of ['vertical-rl', 'vertical-lr'] as const) {
  test(`fits artwork to the physical bounds of a ${writingMode} spread`, async () => {
    const reader = await mount();
    const artwork = image(reader);
    const content = artwork.ownerDocument;
    content.body.style.writingMode = writingMode;
    expect(reader.layout({ spread: 'always', gap: 20 })?.columnWidth).toBe(110);
    expect(artwork.getBoundingClientRect().width).toBe(320);
    expect(artwork.getBoundingClientRect().height).toBe(110);
    reader.flow('scrolled-doc');
    expect(artwork.getBoundingClientRect().width).toBe(1000);
    expect(artwork.getBoundingClientRect().height).toBe(2000);
  });
}
