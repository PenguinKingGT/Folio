/** Exercise actual Blob URL contents and CSS dependencies rather than mocking transformations. */
import { expect, test } from 'vitest';
import { resources, readFixture } from './fixture';

test('loads CSS imports, fonts and encoded image paths into managed URLs', async () => {
  const assets = resources();
  const url = await assets.url('styles/main.css');
  const response = await fetch(url);
  expect(response.headers.get('content-type')).toBe('text/css');
  const css = await response.text();
  expect(css).toContain('@import "blob:');
  expect(css).toContain('url(blob:');
  expect(css).not.toContain('cover%20x.png');
  expect(await assets.url('styles/main.css')).toBe(url);
  expect(await assets.url('images/cover%20x.png#shape')).toMatch(/#shape$/);
  const font = await assets.url('font.woff2');
  expect((await fetch(font)).headers.get('content-type')).toBe('font/woff2');
  expect(await (await fetch(font)).text()).toBe('original font');
  expect((await fetch(await assets.url('unknown.custom'))).headers.get('content-type')).toBe(
    'application/octet-stream',
  );
  assets.destroy();
  assets.destroy();
  await expect(fetch(url)).rejects.toThrow();
  await expect(fetch(font)).rejects.toThrow();
  await expect(assets.url('font.woff2')).rejects.toThrow();
});

test('applies remote policy and canonical resolution without requesting remote assets', async () => {
  const assets = resources({ canonical: (path) => `https://reader.test/${path}` });
  expect(assets.canonical('font.woff2#part')).toBe('https://reader.test/OPS/font.woff2#part');
  expect(assets.canonical('#part')).toBe('#part');
  expect(resources().canonical('font.woff2')).toBe('OPS/font.woff2');
  await expect(assets.url('https://example.org/image.png')).rejects.toThrow('disabled');
  const allowed = resources({ allowRemote: true });
  expect(await allowed.url('https://example.org/image.png')).toBe('https://example.org/image.png');
  expect(await allowed.url('data:image/png;base64,AA==')).toBe('data:image/png;base64,AA==');
  expect(await allowed.url('#symbol')).toBe('#symbol');
});

test('rewrites XHTML assets and styles while keeping reader chapter links', async () => {
  const assets = resources();
  const source = `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink"><head>
    <link href="../styles/main.css"/><style>p{background:url(../images/cover%20x.png)}</style><style/></head><body>
    <a href="next.xhtml#target">Next</a><img src="../images/cover%20x.png"/>
    <video poster="../images/cover%20x.png"/><object data="../font.woff2"/>
    <p style="background:url(../images/cover%20x.png)">Original</p><svg><image xlink:href="../images/cover%20x.png"/><use href="#symbol"/></svg>
  </body></html>`;
  const output = await assets.rewrite(source, 'OPS/text/chapter.xhtml');
  expect(output).toContain('href="next.xhtml#target"');
  expect(output).toContain('src="blob:');
  expect(output).toContain('xlink:href="blob:');
  expect(output).toContain('href="#symbol"');
  expect(output).not.toContain('../images');
  assets.destroy();
});

test('rejects CSS import cycles, bad CSS and missing assets', async () => {
  const cyclic = resources({}, () =>
    Promise.resolve(new TextEncoder().encode('@import "main.css";')),
  );
  await expect(cyclic.url('styles/main.css')).rejects.toThrow('Cyclic');
  const invalid = resources({}, () => Promise.resolve(new TextEncoder().encode('p { color ??? }')));
  await expect(invalid.url('styles/main.css')).rejects.toThrow();
  await expect(resources().url('missing.png')).rejects.toThrow('Missing fixture');
});

test('caller cancellation does not invalidate another read and destruction blocks late URLs', async () => {
  const controller = new AbortController();
  const assets = resources();
  const cancelled = assets.url('font.woff2', undefined, controller.signal);
  const active = assets.url('font.woff2');
  controller.abort();
  await expect(cancelled).rejects.toThrow();
  expect(await active).toBe(await assets.url('font.woff2'));
  await expect(assets.url('font.woff2', undefined, controller.signal)).rejects.toThrow();
  assets.destroy();
  const stale = resources({}, (path, signal) => readFixture(path, signal));
  const pending = stale.url('font.woff2');
  stale.destroy();
  await expect(pending).rejects.toThrow();
});
