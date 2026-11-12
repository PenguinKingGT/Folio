/** Upstream #734: Base64 image URIs are inline assets, not paths under the EPUB directory. */
import { expect, test } from 'vitest';
import { inlineImageIdentity } from './image-identity';

test('keeps and decodes original PNG data URIs without container-path prefixing', async () => {
  expect(await inlineImageIdentity()).toEqual({ widths: [1, 2], retained: true, canonical: true });
});
