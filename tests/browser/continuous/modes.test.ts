/** Continuous chapters follow natural block axes while preserving native CFI coordinates. */
import { afterEach, expect, test } from 'vitest';
import { Book } from '../../../src/index';
import type { Book as Publication } from '../../../src/index';
import { host } from '../render/fixture';
import { continuousBook } from './fixture';
import { bookZip } from '../../unit/book/fixture';
import { fixedFiles } from '../../unit/layout/fixed-fixture';

const opened: { publication: Publication; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ publication, container }) => {
    publication.destroy();
    container.remove();
  }),
);

/** Bind a local publication to one visible test viewport. */
function mount(publication: Publication) {
  const container = host();
  opened.push({ publication, container });
  return publication.renderContinuous(container);
}

for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'] as const) {
  for (const direction of ['ltr', 'rtl'] as const) {
    test(`expands ${mode} ${direction} chapters along their natural block axis`, async () => {
      const reader = mount(await continuousBook(4, 40, mode, direction));
      await reader.display(1);
      await reader.whenIdle();
      const state = reader.flowState;
      expect(state?.axis).toBe(mode === 'horizontal-tb' ? 'vertical' : 'horizontal');
      expect(state?.reverse).toBe(mode === 'vertical-rl');
      const before =
        state?.axis === 'vertical' ? reader.viewport.scrollTop : reader.viewport.scrollLeft;
      await reader.next();
      const after =
        state?.axis === 'vertical' ? reader.viewport.scrollTop : reader.viewport.scrollLeft;
      expect(after - before).toBe((state?.viewport ?? 0) * (state?.reverse ? -1 : 1));
      for (const page of reader.getLoadedPages()) {
        expect(page.document).toBe(page.frame.contentDocument);
        expect(page.document.defaultView?.scrollX).toBe(0);
        expect(page.document.defaultView?.scrollY).toBe(0);
      }
      await reader.display('s3.xhtml#end-3');
      await reader.whenIdle();
      expect(reader.currentLocation()?.atEnd).toBe(true);
      expect(await reader.next()).toBeNull();
      await reader.display({ percentage: 0 });
      await reader.whenIdle();
      expect(reader.currentLocation()?.atStart).toBe(true);
      reader.hide();
      expect(reader.viewport.parentElement?.style.visibility).toBe('hidden');
      reader.show();
      expect(reader.viewport.parentElement?.style.visibility).toBe('');
    });
  }
}

test('fits authored fixed-page viewports along the continuous cross axis', async () => {
  const reader = mount(await Book.open(bookZip(fixedFiles())));
  await reader.display();
  await reader.whenIdle();
  expect(reader.flowState?.axis).toBe('vertical');
  const page = reader.getLoadedPages()[0];
  expect(page?.frame.clientWidth).toBe(600);
  expect(page?.frame.clientHeight).toBe(800);
  expect(page?.frame.getBoundingClientRect().width).toBeCloseTo(320);
  expect(reader.currentLocation()?.start.displayed).toEqual({ page: 1, total: 1 });
  await reader.display(3);
  await reader.next();
  expect(reader.currentLocation()?.atEnd).toBe(true);
});

test('publishes immutable changed snapshots and supports idempotent unsubscribe', async () => {
  const reader = mount(await continuousBook());
  const pages: number[] = [];
  const release = reader.onRelocated((location) => {
    pages.push(location.start.displayed.page);
    expect(Object.isFrozen(location.start.displayed)).toBe(true);
  });
  await reader.display();
  await reader.whenIdle();
  expect(pages).toEqual([1]);
  await reader.next();
  expect(pages.at(-1)).toBe(2);
  release();
  release();
  const count = pages.length;
  await reader.next();
  expect(pages).toHaveLength(count);
});
