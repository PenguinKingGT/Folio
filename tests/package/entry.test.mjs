/** Load built consumer exports and verify declarations and publication scope. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { version } from 'folio-epub';

const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

/** Self-referencing imports must resolve to built ESM through exports. */
test('loads the built package through its public export', () => {
  assert.equal(version, manifest.version);
});

/** Declarations must be discoverable and publication limited to library artifacts and docs. */
test('provides declarations and an explicit publication allowlist', async () => {
  const declaration = await readFile(new URL('../../dist/index.d.ts', import.meta.url), 'utf8');

  assert.match(declaration, /export declare const version/);
  assert.equal(manifest.exports['.'].types, manifest.types);
  assert.deepEqual(manifest.files, ['dist', 'README.md', 'LICENSE']);
});
