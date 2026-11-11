/** Select a contiguous readable window without allowing failed or incompatible neighbors to disappear. */
import type { ContinuousPage } from './page';
import type { Section } from '../spine/section';
import type { WritingState } from '../layout/writing';
import type { PreparedWindow } from './window';

/** Keep only a contiguous compatible run so no failed middle page silently disappears. */
export function readyWindow(
  ready: readonly ContinuousPage[],
  wanted: readonly Section[],
  section: Section,
  writing: WritingState,
  errors: unknown[],
): PreparedWindow {
  const compatible = new Map(
    ready
      .filter((page) => {
        const matches =
          page.measured.writing.axis === writing.axis &&
          page.measured.writing.reverse === writing.reverse;
        if (!matches) {
          errors.push(
            new TypeError('Continuous neighbors must share a block axis and progression.'),
          );
        }
        return matches;
      })
      .map((page) => [page.section.index, page]),
  );
  const slot = wanted.indexOf(section);
  let first = slot;
  let last = slot;
  while (first > 0 && compatible.has(wanted[first - 1]?.index ?? -1)) {
    first -= 1;
  }
  while (last + 1 < wanted.length && compatible.has(wanted[last + 1]?.index ?? -1)) {
    last += 1;
  }
  const pages = wanted.slice(first, last + 1).flatMap((item) => {
    const page = compatible.get(item.index);
    return page === undefined ? [] : [page];
  });
  return { pages, errors };
}
