/** Verify consistency between the public entry point and package version. */
import { expect, test } from 'vitest';
import manifest from '../../package.json';
import { version } from '../../src/index';

/** The public version must match the publication manifest. */
test('exports the package version', () => {
  expect(version).toBe(manifest.version);
});
