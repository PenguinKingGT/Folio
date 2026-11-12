/** Upstream #951: leading-digit manifest identifiers must not redirect native image resource lookup. */
import { expect, test } from 'vitest';
import { imageIdentity } from './image-identity';

test('preserves distinct images when manifest identifiers start with digits and contain hyphens', async () => {
  expect(await imageIdentity(true)).toEqual({ widths: [1, 2], distinct: true, exact: true });
});
