/** 验证公开入口与包版本一致，避免发布元数据漂移。 */
import { expect, test } from 'vitest';
import manifest from '../../package.json';
import { version } from '../../src/index';

/** 版本信息应与发布清单保持一致。 */
test('exports the package version', () => {
  expect(version).toBe(manifest.version);
});
