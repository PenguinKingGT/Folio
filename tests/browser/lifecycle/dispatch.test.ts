/** Destruction inside a legacy relocation callback must terminate that dispatch and invalidate the pending display. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles } from '../continuous/fixture';
import { host } from '../render/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} relocation destruction stops later legacy callbacks and display completion`, async () => {
    const book = await Book.open(bookZip(continuousFiles(3)));
    const container = host();
    const reader = continuous ? book.renderContinuous(container) : book.renderTo(container);
    let first = 0;
    let later = 0;
    reader.onRelocated(() => {
      first += 1;
      reader.destroy();
    });
    reader.onRelocated(() => {
      later += 1;
    });
    try {
      const outcome = await reader.display().then(
        () => 'resolved',
        () => 'rejected',
      );
      expect(first).toBe(1);
      expect(later).toBe(0);
      expect(outcome).toBe('rejected');
      expect(container.children).toHaveLength(0);
    } finally {
      book.destroy();
      container.remove();
    }
  });
}
