# Folio

使用 TypeScript 重写的开源 EPUB 解析与渲染库，计划逐步覆盖 epub.js 的核心能力，并为上游问题建立可追溯的回归测试。

**当前已实现输入规范化和请求适配；EPUB 解压、解析与渲染仍在开发中，尚未承诺兼容 epub.js API。** 本地包名暂定为 `folio-epub`，尚未发布或核实 npm 名称可用性。

## 本地开发

使用 Node.js 24.17.0 和 pnpm 11.8.0。依赖版本与锁文件已固定。

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm dev
```

Linux 环境首次安装浏览器可使用 `pnpm exec playwright install --with-deps chromium firefox webkit` 安装系统依赖。开发服务中的最小示例位于 `/examples/basic/`。

## 常用命令

| 命令                                | 用途                                        |
| ----------------------------------- | ------------------------------------------- |
| `pnpm dev`                          | 启动 Vite 开发示例                          |
| `pnpm build`                        | 构建 ESM、source map 和 TypeScript 声明     |
| `pnpm lint`                         | 类型感知 Oxlint 检查及文件、函数规模限制    |
| `pnpm format` / `pnpm format:check` | 格式化 / 检查格式                           |
| `pnpm typecheck`                    | 检查源码、示例、配置和 TypeScript 测试      |
| `pnpm test` / `pnpm test:watch`     | 执行 / 监听单元测试                         |
| `pnpm test:coverage`                | 检查覆盖率并生成 HTML、LCOV 报告            |
| `pnpm test:package`                 | 构建后验证消费者导入与类型声明产物          |
| `pnpm test:e2e`                     | 在 Chromium、Firefox、WebKit 中验证开发示例 |
| `pnpm check`                        | 执行完整检查，与 CI 保持一致                |
| `pnpm pack`                         | 生成本地发布包，打包前自动构建              |

覆盖率统计包含全部 `src/**/*.ts`，仅排除无运行逻辑的 `.d.ts` 声明文件。每个文件的行、语句、函数覆盖率至少 90%，分支至少 85%。功能测试随实现逐项补充，覆盖范围见迁移清单。

## 工程结构

```text
src/                 新库源码和公开入口
tests/unit/          单元测试
tests/package/       构建产物与包入口测试
tests/e2e/           真实浏览器测试
examples/basic/      最小浏览器开发示例
epub.js/             独立上游参考仓库，保留原状
```

库使用 [Vite 库模式](https://vite.dev/guide/build#library-mode) 生成 ESM，使用 TypeScript 单独生成类型声明。覆盖率通过 [Vitest](https://vitest.dev/guide/coverage) 检查；静态检查使用 [Oxlint 类型感知检查](https://oxc.rs/docs/guide/usage/linter/type-aware)，通过 `oxlint-tsgolint` 检测未处理 Promise 和不安全的类型操作。规则统一维护在 `oxlint.config.ts`，TypeScript 编译器继续独立执行类型检查。当前没有运行时依赖。

开发约定见 [AGENTS.md](./AGENTS.md)，功能范围与实现进度见 [迁移清单](./docs/migration.md)。新增模块按实际需求建立，issue 修复需包含最小复现、回归测试与问题追踪记录。

## 开源许可

新项目使用 [BSD-2-Clause](./LICENSE)。`epub.js/` 中的代码与素材遵循各自原有许可；引用或复用时必须保留相应声明。初始化未复制上游实现或测试夹具。
