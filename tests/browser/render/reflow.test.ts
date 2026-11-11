/** Real geometry and asset changes must preserve a previously visible structural reading position. */
import { afterEach, expect, test } from 'vitest';
import { rangeFromCfi } from '../../../src/index';
import type { Book, Rendition } from '../../../src/index';
import { host } from './fixture';
import { navigationBook } from './navigation-fixture';
import { ReflowObserver } from '../../../src/layout/reflow-observer';

const fontUrl = new URL('../../fixtures/fonts/wide.ttf', import.meta.url).href;

const opened: { publication: Book; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ publication, container }) => {
    publication.destroy();
    container.remove();
  }),
);

/** Open a long chapter at its final named destination. */
async function mounted() {
  const publication = await navigationBook();
  const container = host();
  opened.push({ publication, container });
  const reader = publication.renderTo(container);
  await reader.display('#end');
  return { reader, container };
}

/** Verify the previous anchor is still inside the newly visible reading interval. */
function contains(reader: Rendition, cfi: string): boolean {
  const location = reader.currentLocation();
  const document = reader.getContents();
  return (
    location !== null &&
    document !== null &&
    rangeFromCfi(document, location.start.cfi).compareBoundaryPoints(
      0,
      rangeFromCfi(document, cfi),
    ) <= 0 &&
    rangeFromCfi(document, location.end.cfi).compareBoundaryPoints(
      0,
      rangeFromCfi(document, cfi),
    ) >= 0
  );
}

test('preserves position through host resize, explicit spreads, and hidden resizing', async () => {
  const { reader, container } = await mounted();
  const anchor = reader.currentLocation()?.start.cfi ?? '';
  container.style.width = '500px';
  await expect.poll(() => reader.pagination?.width).toBe(500);
  expect(contains(reader, anchor)).toBe(true);
  reader.layout({ spread: 'always' });
  expect(reader.pagination?.columnsPerView).toBe(2);
  expect(contains(reader, anchor)).toBe(true);
  reader.hide();
  container.style.width = '600px';
  reader.show();
  await expect.poll(() => reader.pagination?.width).toBe(600);
  expect(contains(reader, anchor)).toBe(true);
  container.style.width = '0px';
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  expect(reader.pagination?.width).toBe(600);
  container.style.width = '320px';
  await expect.poll(() => reader.pagination?.width).toBe(320);
});

test('reflows after a real image load while keeping the previous text anchor visible', async () => {
  const { reader } = await mounted();
  const anchor = reader.currentLocation()?.start.cfi ?? '';
  const contents = reader.getContents();
  if (contents === null) {
    throw new Error('Missing image document.');
  }
  const before = reader.pagination?.columns ?? 0;
  const image = contents.createElement('img');
  image.style.display = 'block';
  image.style.width = '320px';
  image.style.height = '480px';
  const loaded = new Promise<void>((resolve) =>
    image.addEventListener('load', () => resolve(), { once: true }),
  );
  contents.body.prepend(image);
  image.src =
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="480"/>';
  await loaded;
  await expect.poll(() => reader.pagination?.columns).toBeGreaterThan(before);
  expect(contains(reader, anchor)).toBe(true);
});

test('reflows after an original font loads and changes text wrapping', async () => {
  const { reader } = await mounted();
  const anchor = reader.currentLocation()?.start.cfi ?? '';
  const contents = reader.getContents();
  if (contents === null) {
    throw new Error('Missing font document.');
  }
  const url = URL.createObjectURL(
    new Blob([await (await fetch(fontUrl)).arrayBuffer()], { type: 'font/ttf' }),
  );
  const before = reader.pagination?.columns ?? 0;
  try {
    const style = contents.createElement('style');
    style.textContent = `@font-face{font-family:FolioWide;src:url("${url}")}p{font-family:FolioWide!important}`;
    contents.head.appendChild(style);
    await contents.fonts.load('16px FolioWide');
    await expect.poll(() => reader.pagination?.columns).toBeGreaterThan(before);
    expect(contains(reader, anchor)).toBe(true);
  } finally {
    URL.revokeObjectURL(url);
  }
});

test('coalesces orientation changes, defers zero-sized frames, and cancels queued work', async () => {
  const { reader, container } = await mounted();
  const contents = reader.getContents();
  if (contents === null) {
    throw new Error('Missing orientation document.');
  }
  let calls = 0;
  const observer = new ReflowObserver(reader.frame, () => {
    calls += 1;
  });
  observer.watch(contents);
  try {
    window.dispatchEvent(new Event('orientationchange'));
    window.dispatchEvent(new Event('orientationchange'));
    container.style.width = '0px';
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    expect(calls).toBe(0);
    container.style.width = '320px';
    await expect.poll(() => calls).toBe(1);
    window.dispatchEvent(new Event('orientationchange'));
    observer.detach();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(calls).toBe(1);
  } finally {
    observer.detach();
  }
});
