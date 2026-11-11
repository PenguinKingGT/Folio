/** Share native fixed-spread measurements and lifecycle cleanup with cross-engine tests. */
import { Book } from '../../../src/index';
import type { PageSide, Rendition } from '../../../src/index';

/** Observable physical geometry and reading boundaries of a fixed-layout spread. */
export interface FixedScenarioResult {
  gap: number;
  native: (number | undefined)[];
  boundaries: (number | undefined)[];
  sides: (PageSide | undefined)[];
  indices: number[];
  next: number | undefined;
  scale: number | undefined;
  pages: number;
}

/** Measure facing frame rectangles separately from each iframe's native containing block. */
function spreadMetrics(reader: Rendition) {
  const pages = reader.getRenderedPages();
  const a = pages[0]?.frame.getBoundingClientRect();
  const b = pages[1]?.frame.getBoundingClientRect();
  if (!a || !b) {
    throw new Error('Missing facing pages.');
  }
  const position = reader.getContents()?.getElementById('position')?.getBoundingClientRect();
  const location = reader.currentLocation();
  return {
    gap: Math.max(a.left, b.left) - Math.min(a.right, b.right),
    native: [
      reader.frame.contentWindow?.innerWidth,
      reader.frame.contentWindow?.innerHeight,
      position?.left,
      position?.top,
    ],
    boundaries: [location?.start.index, location?.end.index],
    sides: [reader.fixedLayout?.primary.side, reader.fixedLayout?.companion?.side],
    indices: pages.map((entry) => entry.section.index),
  };
}

/** Wait for native observation to finish fitting a resized surface. */
function resized(reader: Rendition, host: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    /** Fixed-page geometry changes can leave the logical location snapshot unchanged. */
    function measure(): void {
      if (reader.fixedLayout?.width === 600) {
        resolve();
      } else {
        requestAnimationFrame(measure);
      }
    }
    host.style.width = '600px';
    host.style.height = '400px';
    requestAnimationFrame(measure);
  });
}

/** Render a true spread, advance past both pages, and resize a centered single page. */
export async function runFixedScenario(): Promise<FixedScenarioResult> {
  const host = document.createElement('div');
  host.style.width = '1200px';
  host.style.height = '800px';
  document.body.appendChild(host);
  const book = await Book.open('/fixed.epub');
  const reader = book.renderTo(host, { spread: 'always', gap: 80 });
  try {
    await reader.display(1);
    const metrics = spreadMetrics(reader);
    const next = (await reader.next())?.index;
    reader.layout({ spread: 'none' });
    await resized(reader, host);
    return {
      ...metrics,
      next,
      scale: reader.fixedLayout?.primary.scale,
      pages: reader.getRenderedPages().length,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
