/** Discover nested/imported media queries and skip genuinely inaccessible native stylesheets. */
import { expect, test } from 'vitest';
import { mediaQueries } from '../../../src/layout/media-queries';
import { book, host } from './fixture';

test('discovers stylesheet media attributes, nested groups, and imported conditions', async () => {
  const publication = await book(
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><style media="screen">@supports(display:block){@media(min-width:400px){p{color:black}}}</style></head><body>Original content</body></html>',
  );
  const container = host();
  const reader = publication.renderTo(container);
  const imported = URL.createObjectURL(
    new Blob(['@media(max-width:900px){p{color:black}}'], { type: 'text/css' }),
  );
  const outer = URL.createObjectURL(
    new Blob([`@import url("${imported}");`], { type: 'text/css' }),
  );
  try {
    await reader.display();
    const contents = reader.getContents();
    if (contents === null) {
      throw new Error('Missing stylesheet document.');
    }
    const link = contents.createElement('link');
    link.rel = 'stylesheet';
    link.href = outer;
    const loaded = new Promise<void>((resolve) =>
      link.addEventListener('load', () => resolve(), { once: true }),
    );
    contents.head.appendChild(link);
    await loaded;
    expect(mediaQueries(contents)).toEqual(
      expect.arrayContaining(['screen', '(min-width: 400px)', '(max-width: 900px)']),
    );
  } finally {
    publication.destroy();
    container.remove();
    URL.revokeObjectURL(outer);
    URL.revokeObjectURL(imported);
  }
});

test('skips cross-origin CSSOM rules while retaining readable stylesheets', async () => {
  const url = new URL('/tests/fixtures/media.css', location.href);
  url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  const frame = document.createElement('iframe');
  frame.srcdoc = `<html><head><link rel="stylesheet" href="${url.href}"/><style>@media print{p{color:black}}</style></head><body/></html>`;
  const loaded = new Promise<void>((resolve) =>
    frame.addEventListener('load', () => resolve(), { once: true }),
  );
  document.body.appendChild(frame);
  try {
    await loaded;
    const contents = frame.contentDocument;
    const foreign = contents?.styleSheets[0];
    if (contents === null || foreign === undefined) {
      throw new Error('Missing cross-origin stylesheet.');
    }
    expect(() => foreign.cssRules).toThrow();
    expect(mediaQueries(contents)).toEqual(['print']);
  } finally {
    frame.remove();
  }
});
