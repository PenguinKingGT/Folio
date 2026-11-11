/** Theme CSS compilation preserves import conditions, relative assets, resource policy, and bounded failures. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { ThemeCompiler } from '../../../src/themes/compiler';
import { bookFiles, bookZip } from '../book/fixture';

test('inlines nested CSS imports and resolves each asset against its own source path', async () => {
  const files = bookFiles();
  files.set(
    'OPS/themes/main.css',
    '@charset "UTF-8";@import "parts/colors.css" layer(palette) supports(display:grid) screen;p{color:red}',
  );
  files.set(
    'OPS/themes/parts/colors.css',
    '@import "nested.css" layer;body{background-image:url(../../images/cover.jpg)}',
  );
  files.set('OPS/themes/parts/nested.css', 'h1{color:blue}');
  const book = await Book.open(bookZip(files));
  try {
    const compiler = new ThemeCompiler(book);
    const css = await compiler.compile({ url: 'themes/main.css' }, new AbortController().signal);
    expect(css).toContain('@layer palette{@supports (display:grid){@media screen{');
    expect(css).toContain('@layer{h1{color:blue}}');
    expect(css).not.toContain('@import');
    expect(css).not.toContain('@charset');
    const asset = await book.resources.url('images/cover.jpg');
    expect(css).toContain(asset);
    const direct = await compiler.compile(
      { css: 'body{background:url(../images/cover.jpg)}', from: 'OPS/themes/inline.css' },
      new AbortController().signal,
    );
    expect(direct).toContain(asset);
    expect(
      await compiler.compile(
        { rules: { body: { color: 'red!important' } } },
        new AbortController().signal,
      ),
    ).toBe('body{color:red!important}');
  } finally {
    book.destroy();
  }
});

test('rejects cycles, deep imports, malformed CSS and size expansion before exposing a theme', async () => {
  const files = bookFiles();
  files.set('OPS/cycle.css', '@import "cycle.css";');
  for (let index = 0; index < 17; index += 1) {
    files.set(`OPS/deep${index}.css`, `@import "deep${index + 1}.css";`);
  }
  files.set('OPS/large.css', `p{--value:${'x'.repeat(600_000)}}`);
  const book = await Book.open(bookZip(files));
  try {
    const compiler = new ThemeCompiler(book);
    for (const url of ['cycle.css', 'deep0.css']) {
      await expect(compiler.compile({ url }, new AbortController().signal)).rejects.toThrow(
        'imports',
      );
    }
    await expect(
      compiler.compile(
        { css: '@import "large.css";@import "large.css";' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Expanded');
    await expect(
      compiler.compile({ css: 'x'.repeat(1_000_001) }, new AbortController().signal),
    ).rejects.toThrow('size');
    await expect(
      compiler.compile({ css: 'p{color:;broken}' }, new AbortController().signal),
    ).rejects.toThrow();
    for (const url of [
      '#fragment',
      'data:text/css,p{}',
      'https://denied.invalid/theme.css',
      '../outside.css',
    ]) {
      await expect(compiler.compile({ url }, new AbortController().signal)).rejects.toThrow();
    }
    const aborted = AbortSignal.abort();
    await expect(compiler.compile({ css: 'p{}' }, aborted)).rejects.toThrow();
    await expect(compiler.compile({ url: 'cycle.css' }, aborted)).rejects.toThrow();
  } finally {
    book.destroy();
  }
});

test('allowed remote styles and imports use custom transport with remote-relative references', async () => {
  const files = bookFiles();
  const requests: string[] = [];
  const book = await Book.open(bookZip(files), {
    allowRemote: true,
    fetch: (input) => {
      const url = input instanceof Request ? input.url : input.toString();
      requests.push(url);
      return Promise.resolve(
        new Response(
          url.endsWith('base.css')
            ? '@import "part.css";p{background:url(image.svg)}'
            : 'p{color:teal}',
        ),
      );
    },
  });
  try {
    const css = await new ThemeCompiler(book).compile(
      { url: 'https://original.invalid/base.css' },
      new AbortController().signal,
    );
    expect(css).toContain('p{color:teal}');
    expect(css).toContain('https://original.invalid/image.svg');
    expect(requests).toEqual([
      'https://original.invalid/base.css',
      'https://original.invalid/part.css',
    ]);
  } finally {
    book.destroy();
  }
});
