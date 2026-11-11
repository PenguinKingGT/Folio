/** 从消费者入口加载实际构建产物，并检查类型声明与发布文件范围。 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { URL } from 'node:url';
import { version } from 'folio-epub';

const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

/** 自引用导入必须通过 exports 指向 ESM 产物。 */
test('loads the built package through its public export', () => {
  assert.equal(version, manifest.version);
});

/** 类型声明应可供消费者定位，发布范围仅包含库与说明文件。 */
test('provides declarations and an explicit publication allowlist', async () => {
  const declaration = await readFile(new URL('../../dist/index.d.ts', import.meta.url), 'utf8');

  assert.match(declaration, /export declare const version/);
  assert.equal(manifest.exports['.'].types, manifest.types);
  assert.deepEqual(manifest.files, ['dist', 'README.md', 'LICENSE']);
});
