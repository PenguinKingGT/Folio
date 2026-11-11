/** Cross-engine scenario exposes logical progress and signed native coordinates for every supported writing mode. */
import { Book } from '../../../src/index';
import type { FlowState, ReadingFlow } from '../../../src/index';

/** Observable navigation results, independent of browser-specific glyph metrics. */
export interface WritingResult {
  state: FlowState | null;
  native: number | undefined;
  expected: number;
  page: number | undefined;
  atEnd: boolean | undefined;
  restored: boolean | undefined;
  spreadEnd: boolean | undefined;
}

/** Exercise page/viewport movement, end anchors, CFI restoration, and complete final spreads. */
export async function runWritingScenario(flow: ReadingFlow): Promise<WritingResult> {
  const host = document.createElement('div');
  host.style.width = '320px';
  host.style.height = '240px';
  document.body.appendChild(host);
  const book = await Book.open('/writing.epub');
  const reader = book.renderTo(host, { flow, spread: 'none' });
  try {
    await reader.display();
    const original = reader.currentLocation()?.start.cfi ?? '';
    await reader.next();
    const state = reader.flowState;
    const native =
      state?.axis === 'horizontal'
        ? reader.getContents()?.defaultView?.scrollX
        : reader.getContents()?.defaultView?.scrollY;
    const expected =
      (reader.pagination?.advance ?? state?.viewport ?? 0) * (state?.reverse ? -1 : 1);
    const page = reader.currentLocation()?.start.displayed.page;
    await reader.display('#end');
    const atEnd = reader.currentLocation()?.atEnd;
    await reader.display(original);
    const restored = reader.currentLocation()?.atStart;
    if (flow === 'paginated') {
      reader.layout({ spread: 'always' });
    }
    await reader.display('#end');
    return {
      state,
      native,
      expected,
      page,
      atEnd,
      restored,
      spreadEnd: reader.currentLocation()?.atEnd,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
