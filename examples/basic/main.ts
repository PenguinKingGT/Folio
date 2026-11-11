/** Load the source entry point to verify browser integration with Vite. */
import { version } from '../../src/index';

const status = document.querySelector('[role="status"]');

if (status === null) {
  throw new Error('示例缺少加载状态元素。');
}

status.textContent = `Folio v${version} 已加载`;
