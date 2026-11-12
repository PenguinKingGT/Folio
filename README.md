# Folio

An open-source TypeScript EPUB library that progressively replaces epub.js capabilities with traceable regression coverage.

**Implemented: headless EPUB 2/3 and JSON loading; reflowable, fixed-layout and continuous iframe reading; RTL/vertical writing; CFI/progress/print-page navigation; touch, themes, search, annotations, typed events, extension hooks and offline storage. Explicit scripted reading uses a separate opaque sandbox.** See the [migration tracker](./docs/migration.md) for tested scope and intentional compatibility exclusions. This is not a drop-in epub.js API replacement or a claim that all upstream issues are resolved. The local package name `folio-epub` has not been published or checked for npm availability.

## Development

Use Node.js 24.17.0 and pnpm 11.8.0. Dependency versions and the lockfile are pinned.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium firefox webkit
pnpm check
pnpm dev
```

On Linux, install browser system dependencies with `pnpm exec playwright install --with-deps chromium firefox webkit`. Open `/examples/basic/` on the development server.

## Commands

| Command                             | Purpose                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                          | Run the Vite example server                                 |
| `pnpm build`                        | Build ESM, source maps, and declarations                    |
| `pnpm lint`                         | Type-aware Oxlint checks and file/function size limits      |
| `pnpm format` / `pnpm format:check` | Format / check formatting                                   |
| `pnpm typecheck`                    | Check source, examples, configuration, and TypeScript tests |
| `pnpm test` / `pnpm test:watch`     | Run / watch unit and native-browser tests                   |
| `pnpm test:coverage`                | Check thresholds; generate HTML and LCOV reports            |
| `pnpm test:package`                 | Build and verify package imports and declaration artifacts  |
| `pnpm test:e2e`                     | Test the example in Chromium, Firefox, and WebKit           |
| `pnpm check`                        | Run the complete CI validation pipeline                     |
| `pnpm pack`                         | Build and create a local package archive                    |

Coverage includes every `src/**/*.ts` file except declaration-only `.d.ts` files. Each file must reach 90% lines, statements, and functions, and 85% branches. Feature tests grow with implementation; see the migration tracker.

## Structure

```text
src/                 Library source and public entry point
tests/unit/          Node unit tests
tests/browser/       Native Chromium tests with merged coverage
tests/package/       Package import and artifact tests
tests/e2e/           Real-browser tests
examples/basic/      Minimal development example
epub.js/             Unchanged upstream reference repository
```

[Vite library mode](https://vite.dev/guide/build#library-mode) produces ESM; TypeScript emits declarations separately. [Vitest](https://vitest.dev/guide/coverage) measures coverage. [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware), backed by `oxlint-tsgolint`, checks unsafe type operations and unhandled promises. Rules live in `oxlint.config.ts`; TypeScript also runs independently. ZIP decompression uses `fflate`; environment-independent XML parsing uses `@xmldom/xmldom`. CSS reference rewriting uses `css-tree` to handle escaped URLs and imports through an AST. All three dependencies use the MIT license.

See [development guidelines](./AGENTS.md), the [migration tracker](./docs/migration.md), [input/request APIs](./docs/input.md), and [archive APIs](./docs/archive.md), [lifecycle semantics](./docs/lifecycle.md), and [security boundaries](./docs/security.md). All comments and documentation must be in English. Every feature requires tests and a separate verified commit.

## License

New project code uses [BSD-2-Clause](./LICENSE). Upstream code and assets retain their original licenses and notices. No upstream implementation or fixtures have been copied into the new library.
