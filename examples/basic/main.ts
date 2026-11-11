/** 从源码入口加载版本信息，验证 Vite 开发服务的浏览器集成。 */
import { version } from '../../src/index';

const status = document.querySelector('[role="status"]');

if (status === null) {
  throw new Error('示例缺少加载状态元素。');
}

status.textContent = `Folio v${version} 已加载`;
