# Folio Development Guidelines

## Project scope and repository

Folio is an open-source TypeScript rewrite of epub.js. Gradually replace its capabilities and build traceable fixes and regression tests for unresolved upstream issues.

The root contains the new library: `src/`, unit/package/browser tests under `tests/`, and `examples/basic/`. The nested `epub.js/` Git repository is an upstream reference using JavaScript, Webpack, and Karma; its scripts are not the new project's conventions.

- Keep `epub.js/` unchanged unless explicitly asked to modify it. Implement the replacement in the root project.
- The estimated 500 upstream issues are a planning scope, not a verified live count. Record the query date when inventorying issues.
- Distinguish specification requirements, upstream behavior, and intentional design changes. Document compatibility decisions.
- Track feature implementation in `docs/migration.md`. Implement, test, update the tracker, and commit each feature before proceeding to the next one.

## Engineering

- Use TypeScript, Vite library mode, pnpm, and ESM. Keep examples separate and avoid UI framework dependencies in the library.
- Enable `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`; publish declarations. Validate external `unknown` values before narrowing; avoid `any` and unchecked assertions.
- Commit `pnpm-lock.yaml`; pin the package manager and supported Node.js range.
- Use Oxlint with type-aware rules, Prettier, Vitest coverage, and Playwright for real-browser behavior.
- Use scripts from `package.json`; `pnpm check` runs the full validation pipeline. See `README.md` for commands.
- CI must use frozen-lockfile installation and fail on any unsuccessful check, test, or build.
- Evaluate dependency necessity, bundle cost, licensing, and maintenance. Preserve applicable copyright and license notices when reusing upstream code or fixtures.

## Modules and maintainability

- Separate parsing, archives/resources, navigation/CFI, layout/rendering, annotations, and compatibility as needed. Introduce modules for actual responsibilities rather than empty scaffolding.
- Keep parsing and models independent of the browser DOM where practical. Put network, browser APIs, and storage behind explicit testable boundaries.
- Export public APIs from explicit entry points. Internal imports target concrete files; avoid cycles and hidden mutable global state.
- Keep handwritten source and test files within 300 lines and functions/methods within 50 lines. Split by responsibility first. Explain necessary exceptions in the change description rather than adding meaningless wrappers.
- Size limits exclude unchanged upstream references, lockfiles, generated artifacts, and raw fixtures. Do not use generated code to bypass these limits.
- Use readable multiline control flow and consistent indentation. Avoid packed statements, nested ternaries, and compressed complex logic.
- Define error, cancellation, concurrency, and destruction behavior. Release listeners, observers, iframes, and object URLs; repeated cleanup must be safe.

## Comments and documentation

- **Write all comments and documentation in English.** This includes file headers, TSDoc, inline comments, Markdown, and documentation examples. Preserve upstream reference files and intentional multilingual test data.
- Add a concise responsibility comment to each handwritten source/test file. Document classes, methods, and functions; use TSDoc for public inputs, results, errors, and side effects.
- Explain invariants, constraints, complex branches, compatibility decisions, and algorithms at their relevant locations. Link verifiable standards or issues when applicable.
- Keep comments consistent with implementation. Prefer clear naming and module boundaries over narrating obvious statements.
- Update API documentation and examples when public behavior changes.

## Testing

- Every feature and fix needs behavior-focused tests for success, boundaries, invalid input, and errors. Add regression tests when changing existing behavior.
- Coverage includes all new-library source, even files not imported by tests. Require at least 90% statements, lines, and functions, and 85% branches. Explain exclusions; only declarations, generated files, and raw fixtures are eligible.
- Unit-test parsing, paths, CFI, navigation, and resources. Integration-test loading a book through reading its chapters.
- Verify pagination, scrolling, selection, font loading, and resize behavior in real browsers. DOM emulation cannot establish layout correctness.
- Add minimal EPUB 2/3, encoded-path, namespace, RTL, vertical-writing, reflowable, and fixed-layout fixtures as features require. Record fixture provenance and licensing.
- Treat EPUB as untrusted input. Specify and test traversal prevention, malformed XML handling, archive limits, script isolation, and remote resource policies.
- Keep tests deterministic with local fixtures and controlled asynchronous conditions. Test cancellation, concurrent loads, and cleanup without external services or arbitrary sleeps.
- Do not skip tests, lower thresholds, swallow errors, or mock away the logic under test to make checks pass.

## Upstream issues

1. Read the issue, discussion, and related implementation. Record its URL, query date, reproduction conditions, and expected behavior. Mark insufficient evidence as awaiting reproduction.
2. Classify parsing, resources, CFI, rendering, interaction, performance, types, or documentation; link duplicates and dependencies. Prioritize data corruption, security, and blocked reading workflows.
3. Create a minimal automated reproduction. Confirm the regression fails before the fix and passes afterward.
4. Fix the responsible module and check related behavior, compatibility, and cleanup.
5. Record issue IDs, evidence, local test paths, and status under `docs/issues/`. Distinguish reproduced, verified fix, duplicate, design difference, and out of scope. Local resolution and upstream closure are separate states.
6. Claim resolution only with traceable verification, never for unexamined batches of issues.

## Completion

- Keep each feature change focused; avoid unrelated refactoring.
- Run formatting, lint, type, unit, coverage, and build checks; run relevant browser tests for browser behavior.
- Report unavailable checks and their reasons accurately; unexecuted checks are not passing checks.
- Update behavior documentation and issue/feature tracking, then commit the verified feature before starting another.
