# Folio

An open-source TypeScript EPUB library that progressively replaces epub.js capabilities with traceable regression coverage.

**Implemented: input normalization, request adapters, ZIP resource access, and OCF container parsing. Package parsing and rendering are still in development; epub.js API compatibility is not yet guaranteed.** The local package name `folio-epub` has not been published or checked for npm availability.

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
| `pnpm test` / `pnpm test:watch`     | Run / watch unit tests                                      |
| `pnpm test:coverage`                | Check thresholds; generate HTML and LCOV reports            |
| `pnpm test:package`                 | Build and verify package imports and declaration artifacts  |
| `pnpm test:e2e`                     | Test the example in Chromium, Firefox, and WebKit           |
| `pnpm check`                        | Run the complete CI validation pipeline                     |
| `pnpm pack`                         | Build and create a local package archive                    |

Coverage includes every `src/**/*.ts` file except declaration-only `.d.ts` files. Each file must reach 90% lines, statements, and functions, and 85% branches. Feature tests grow with implementation; see the migration tracker.

## Structure

```text
src/                 Library source and public entry point
tests/unit/          Unit tests
tests/package/       Package import and artifact tests
tests/e2e/           Real-browser tests
examples/basic/      Minimal development example
epub.js/             Unchanged upstream reference repository
```

[Vite library mode](https://vite.dev/guide/build#library-mode) produces ESM; TypeScript emits declarations separately. [Vitest](https://vitest.dev/guide/coverage) measures coverage. [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware), backed by `oxlint-tsgolint`, checks unsafe type operations and unhandled promises. Rules live in `oxlint.config.ts`; TypeScript also runs independently. ZIP decompression uses `fflate`; environment-independent XML parsing uses `@xmldom/xmldom`. Both dependencies use the MIT license.

See [development guidelines](./AGENTS.md), the [migration tracker](./docs/migration.md), [input/request APIs](./docs/input.md), and [archive APIs](./docs/archive.md). All comments and documentation must be in English. Every feature requires tests and a separate verified commit.

## License

New project code uses [BSD-2-Clause](./LICENSE). Upstream code and assets retain their original licenses and notices. No upstream implementation or fixtures have been copied into the new library.
