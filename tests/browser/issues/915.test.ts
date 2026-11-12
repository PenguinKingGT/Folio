/** Upstream #915: dotted and undotted filenames must decode as their own distinct publication images. */
import { expect, test } from 'vitest';
import { imageIdentity } from './image-identity';

test('does not conflate 17.3.png and 173.png during native resource rewriting', async () => {
  expect(await imageIdentity()).toEqual({ widths: [1, 2], distinct: true, exact: true });
});
