/** Verify expanded native contexts, real cross-chapter scrolling, bounded preloading, and stable compensation. */
import { afterEach, expect, test } from 'vitest';
import { rangeFromCfi } from '../../../src/index';
import type { Book, ContinuousOptions } from '../../../src/index';
import { host } from '../render/fixture';
import { continuousBook } from './fixture';

const opened: { publication: Book; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ publication, container }) => {
    publication.destroy();
    container.remove();
  }),
);

/** Register a measurable host and book for deterministic cleanup. */
function mount(publication: Book, options: ContinuousOptions = {}) {
  const container = host();
  opened.push({ publication, container });
  return { container, reader: publication.renderContinuous(container, options) };
}

test('loads lazily, expands chapters, and reports only the clipped visible text', async () => {
  const { reader } = mount(await continuousBook());
  expect(reader.getContents()).toBeNull();
  expect(reader.currentSection).toBeNull();
  expect(reader.currentLocation()).toBeNull();
  expect(reader.flowState).toBeNull();
  await reader.whenIdle();
  expect(reader.loadedSections).toEqual([]);
  await reader.display();
  await reader.whenIdle();
  expect(reader.loadedSections.map((section) => section.index)).toEqual([0, 1]);
  const first = reader.getLoadedPages()[0];
  expect(first?.document).toBe(first?.frame.contentDocument);
  expect(first?.frame.clientHeight).toBeGreaterThan(240);
  expect(reader.currentLocation()?.atStart).toBe(true);
  await reader.next();
  const location = reader.currentLocation();
  const contents = reader.getContents();
  if (!contents || !location) {
    throw new Error('Missing continuous location.');
  }
  expect(rangeFromCfi(contents, location.start.cfi).startOffset).toBeGreaterThan(0);
  expect(reader.flowState?.flow).toBe('scrolled-continuous');
  expect(reader.lastError).toBeNull();
});

test('retains browsing contexts while trimming distant chapters and preloading adjacent ones', async () => {
  const { reader, container } = mount(await continuousBook());
  await reader.display();
  await reader.whenIdle();
  const old = reader.getLoadedPages()[0];
  await reader.display(4);
  await reader.whenIdle();
  expect(reader.loadedSections.map((section) => section.index)).toEqual([3, 4, 5]);
  expect(old?.frame.isConnected).toBe(false);
  const kept = reader.getLoadedPages().find((page) => page.section.index === 4);
  await reader.prev();
  expect(reader.currentSection?.index).toBe(3);
  expect(reader.getLoadedPages().find((page) => page.section.index === 4)?.document).toBe(
    kept?.document,
  );
  expect(kept?.document).toBe(kept?.frame.contentDocument);
  expect(container.querySelectorAll('iframe').length).toBeLessThanOrEqual(3);
});

test('compensates scroll when an earlier unknown chapter replaces its estimated size', async () => {
  const { reader } = mount(await continuousBook());
  await reader.display(5);
  await reader.whenIdle();
  const previous = reader.getLoadedPages().find((page) => page.section.index === 4);
  if (!previous) {
    throw new Error('Missing preloaded preceding chapter.');
  }
  reader.viewport.scrollTop -= 100;
  const before = previous.frame.getBoundingClientRect().top;
  const cfi = reader.currentLocation()?.start.cfi;
  const offset = reader.viewport.scrollTop;
  await reader.whenIdle();
  expect(reader.currentLocation()?.start.cfi).toBe(cfi);
  expect(previous.frame.getBoundingClientRect().top).toBeCloseTo(before, 0);
  expect(reader.viewport.scrollTop).toBeGreaterThan(offset);
  expect(reader.loadedSections.map((section) => section.index)).toEqual([3, 4, 5]);
  expect(previous.frame.contentDocument).toBe(previous.document);
});

test('fills short chapters across a viewport instead of forcing one blank page per chapter', async () => {
  const { reader } = mount(await continuousBook(8, 0));
  await reader.next();
  await reader.whenIdle();
  expect(reader.getRenderedPages().length).toBeGreaterThan(1);
  expect(reader.getLoadedPages()[0]?.frame.clientHeight).toBe(40);
  await reader.next();
  expect(reader.currentLocation()?.atEnd).toBe(true);
  expect(await reader.next()).toBeNull();
  await reader.prev();
  expect(reader.currentLocation()?.atStart).toBe(true);
  expect(await reader.prev()).toBeNull();
});

test('loads an estimated distant scroll range and retains the relative reading position', async () => {
  const { reader } = mount(await continuousBook());
  await reader.display();
  const state = reader.flowState;
  if (!state) {
    throw new Error('Missing continuous flow.');
  }
  reader.viewport.scrollTop = state.length - 300;
  expect(reader.currentLocation()).toBeNull();
  await reader.whenIdle();
  expect(reader.currentSection?.index).toBe(6);
  expect(reader.currentLocation()).not.toBeNull();
  expect(reader.loadedSections.map((section) => section.index)).toEqual([5, 6, 7]);
});
