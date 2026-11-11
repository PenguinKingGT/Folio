/** Virtual position restoration tolerates empty reading orders and not-yet-loaded chapters. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { ContinuousPort } from '../../../src/continuous/port';
import { ContinuousWindow } from '../../../src/continuous/window';
import {
  readingReference,
  restoreReference,
  scrollToPosition,
} from '../../../src/continuous/position';
import { host } from '../render/fixture';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles } from './fixture';

test('does not invent a reading position or scroll before any readable chapter is installed', async () => {
  const files = continuousFiles(1);
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace('idref="chapter"', 'idref="chapter" linear="no"'),
  );
  const book = await Book.open(bookZip(files));
  const container = host();
  const port = new ContinuousPort(container, {});
  const window = new ContinuousWindow(book, port, {}, () => {});
  try {
    expect(readingReference(port, window, null)).toBeNull();
    scrollToPosition(port, window, 200);
    restoreReference(port, window, null, true);
    restoreReference(port, window, { index: 0, local: 0.5, fractional: true, cfi: null }, true);
    expect(port.offset()).toBe(0);
  } finally {
    window.destroy();
    port.destroy();
    book.destroy();
    container.remove();
  }
});
