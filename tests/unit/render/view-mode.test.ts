/** Legacy mode compatibility is explicit and rejects silent host-document rendering fallbacks. */
import { expect, test } from 'vitest';
import { validateViewMode } from '../../../src/render/view-mode';

test('accepts absent/iframe selectors and rejects inline, constructor, null, and unknown selectors', () => {
  expect(() => validateViewMode(undefined)).not.toThrow();
  expect(() => validateViewMode('iframe')).not.toThrow();
  for (const mode of ['inline', 'div', 'unknown', null, {}, 1, () => {}]) {
    expect(() => validateViewMode(mode)).toThrow('Book.renderWith');
  }
});
