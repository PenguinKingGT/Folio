/** Cross-engine gesture scenarios use real native pagination with deterministic touch Pointer Events. */
import { Book } from '../../../src/index';
import { swipe } from './fixture';

/** Observable touch behavior independent of browser-specific text metrics. */
interface TouchResult {
  page: number | undefined;
  snapped: boolean;
  restored: boolean | undefined;
  passiveScripts: boolean;
}

/** Exercise physical gesture direction, nearest-spread snapping, and listener cleanup. */
export async function runTouchScenario(): Promise<TouchResult> {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  const book = await Book.open('/touch.epub');
  const reader = book.renderTo(host, { touch: true, spread: 'none' });
  try {
    await reader.display();
    const document = reader.getContents();
    const state = reader.flowState;
    const pages = reader.pagination;
    if (!document || !state || !pages) {
      throw new Error('Missing touch pagination.');
    }
    const distance = state.reverse ? 100 : -100;
    const detach = reader.touch.bind(host);
    swipe(
      host,
      state.axis === 'horizontal' ? distance : 0,
      state.axis === 'vertical' ? distance : 0,
    );
    await reader.touch.whenIdle();
    const page = reader.currentLocation()?.start.displayed.page;
    const offset = pages.advance * 1.6 * (state.reverse ? -1 : 1);
    document.defaultView?.scrollTo(
      state.axis === 'horizontal' ? offset : 0,
      state.axis === 'vertical' ? offset : 0,
    );
    // A host tap requests snapping even when passive-frame callbacks are unavailable.
    swipe(host, 0, 0);
    const native =
      state.axis === 'horizontal' ? document.defaultView?.scrollX : document.defaultView?.scrollY;
    const snapped = native === pages.advance * 2 * (state.reverse ? -1 : 1);
    await reader.display(0);
    const restored = reader.currentLocation()?.atStart;
    const passiveScripts = !reader.frame.sandbox.contains('allow-scripts');
    detach();
    reader.destroy();
    return { page, snapped, restored, passiveScripts };
  } finally {
    book.destroy();
    host.remove();
  }
}
