/** Three native engines retain XML/CSS semantics and enforce explicit opaque worker isolation. */
import { expect, test } from '@playwright/test';
import { bookFiles, bookZip } from '../unit/book/fixture';
import { styledChapter } from '../browser/security/styles';

// The scenario module is imported by Vite inside page.evaluate; only its fixture string is used here.
for (const scripted of [false, true]) {
  test(`${scripted ? 'scripted worker isolation' : 'passive raw-text CSS'} survives the native iframe boundary`, async ({
    page,
  }) => {
    const files = bookFiles();
    if (!scripted) {
      files.set('OPS/text/chapter one.xhtml', styledChapter);
    }
    await page.route('**/security.epub', (route) =>
      route.fulfill({ body: Buffer.from(bookZip(files)) }),
    );
    await page.goto('/examples/basic/');
    await expect(page.getByRole('status')).toContainText('已加载');
    const result = await page.evaluate(async (execute) => {
      const { Book } = await import('../../src/index');
      const book = await Book.open('/security.epub');
      if (execute) {
        return (await import('../../tests/browser/security/workers')).workerScenario(book);
      }
      return (await import('../../tests/browser/security/styles')).styleScenario(book);
    }, scripted);
    if (scripted) {
      expect(result).toEqual({ worker: 'blocked' });
    } else {
      expect(result).toMatchObject({ color: 'rgb(1, 2, 3)', scripts: 0, compromised: false });
      expect(result).toHaveProperty(
        'content',
        expect.stringContaining('< & > &gt; </style><script>'),
      );
    }
  });
}
