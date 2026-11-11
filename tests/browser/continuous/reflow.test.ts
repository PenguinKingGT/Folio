/** Expanded documents must preserve logical reading anchors across repeated host/content changes. */
import { afterEach, expect, test } from 'vitest';
import { Cfi } from '../../../src/index';
import type { Book, ContinuousReader } from '../../../src/index';
import { host } from '../render/fixture';
import { continuousBook } from './fixture';

const opened: { publication: Book; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ publication, container }) => {
    publication.destroy();
    container.remove();
  }),
);

/** Attach an original book and register all owned resources for cleanup. */
async function mounted() {
  const publication = await continuousBook();
  const container = host();
  opened.push({ publication, container });
  return { container, reader: publication.renderContinuous(container) };
}

/** Compare whole-book CFIs rather than native ranges from different chapter documents. */
function contains(reader: ContinuousReader, point: string): boolean {
  const location = reader.currentLocation();
  return (
    location !== null &&
    new Cfi(location.start.cfi).compare(new Cfi(point)) <= 0 &&
    new Cfi(location.end.cfi).compare(new Cfi(point)) >= 0
  );
}

test('keeps the original reading CFI visible through repeated automatic width changes', async () => {
  const { reader, container } = await mounted();
  await reader.display(5);
  await reader.next();
  await reader.next();
  const anchor = reader.currentLocation()?.start.cfi ?? '';
  for (const width of [800, 200, 500, 300, 900, 210, 700, 220, 600, 240, 800, 200]) {
    container.style.width = `${width}px`;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await reader.whenIdle();
    expect(contains(reader, anchor)).toBe(true);
  }
});

test('reflows earlier loaded content without moving the current reading anchor', async () => {
  const { reader } = await mounted();
  await reader.display(5);
  await reader.next();
  const anchor = reader.currentLocation()?.start.cfi ?? '';
  const before = reader.getLoadedPages().find((page) => page.section.index === 4);
  if (!before) {
    throw new Error('Missing preceding ready page.');
  }
  const image = before.document.createElement('img');
  image.style.height = '400px';
  image.style.width = '300px';
  image.style.display = 'block';
  const loaded = new Promise<void>((resolve) =>
    image.addEventListener('load', () => resolve(), { once: true }),
  );
  before.document.body.appendChild(image);
  image.src =
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"/>';
  await loaded;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await reader.whenIdle();
  expect(contains(reader, anchor)).toBe(true);
});

test('reflows loaded fonts without losing the logical reading point', async () => {
  const { reader } = await mounted();
  await reader.display(4);
  await reader.next();
  const anchor = reader.currentLocation()?.start.cfi ?? '';
  const page = reader.getLoadedPages().find((entry) => entry.section.index === 4);
  if (!page) {
    throw new Error('Missing font chapter.');
  }
  const url = URL.createObjectURL(
    new Blob(
      [
        await (
          await fetch(new URL('../../fixtures/fonts/wide.ttf', import.meta.url))
        ).arrayBuffer(),
      ],
      { type: 'font/ttf' },
    ),
  );
  const height = page.frame.clientHeight;
  try {
    const style = page.document.createElement('style');
    style.textContent = `@font-face{font-family:FolioWide;src:url("${url}")}p{font-family:FolioWide!important}`;
    page.document.head.appendChild(style);
    await page.document.fonts.load('16px FolioWide');
    await expect.poll(() => page.frame.clientHeight).toBeGreaterThan(height);
    await reader.whenIdle();
    expect(contains(reader, anchor)).toBe(true);
  } finally {
    URL.revokeObjectURL(url);
  }
});

test('defers zero-sized hosts and resumes without leaking queued work after destruction', async () => {
  const { reader, container } = await mounted();
  await reader.display(4);
  container.style.width = '0px';
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await reader.whenIdle();
  container.style.width = '250px';
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await reader.whenIdle();
  expect(reader.currentSection?.index).toBe(4);
  container.style.width = '300px';
  reader.viewport.dispatchEvent(new Event('scroll'));
  reader.destroy();
  expect(container.children).toHaveLength(0);
});
