/** Verify compiled bootstrap serialization through a real consumer browser, independent of Vite's source transform. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { chromium } from '@playwright/test';
import { version } from 'folio-epub';

const files = new Map([
  ['/', '<div id="reader" style="width:400px;height:300px"></div>'],
  [
    '/package.opf',
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">original-package</dc:identifier><dc:title>Original packaged reader</dc:title><dc:language>en</dc:language></metadata>
    <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>
    <spine><itemref idref="chapter"/></spine></package>`,
  ],
  [
    '/chapter.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original package</p>
    <script><![CDATA[
      var denied = false;
      try { parent.document.body.setAttribute('data-escaped','yes'); } catch (error) { denied = true; }
      window.folio.postMessage({kind:'packaged',denied:denied,name:navigator.epubReadingSystem.name,
        version:navigator.epubReadingSystem.version,dom:navigator.epubReadingSystem.hasFeature('dom-manipulation')});
    ]]></script></body></html>`,
  ],
]);

/** Serve only the built library and the locally authored minimal direct-OPF publication. */
async function consumerServer() {
  const bundle = await readFile(new URL('../../dist/folio.js', import.meta.url));
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (path === '/folio.js') {
      response.writeHead(200, { 'content-type': 'application/javascript' }).end(bundle);
      return;
    }
    const source = files.get(path);
    response
      .writeHead(source === undefined ? 404 : 200, { 'content-type': 'text/html' })
      .end(source ?? 'missing');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP consumer server.');
  }
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

test('built package executes its serialized opaque bootstrap and preserves public reading-system identity', async () => {
  const { server, origin } = await consumerServer();
  try {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(origin);
      const result = await page.evaluate(async () => {
        const { Book } = await import('/folio.js');
        const book = await Book.open('/package.opf');
        const reader = book.renderScriptedTo('#reader', { scripts: true });
        const messages = [];
        reader.on('message', (value) => messages.push(value));
        try {
          await reader.display();
          const opaque = reader.frame.contentDocument === null;
          book.destroy();
          return {
            opaque,
            message: messages[0],
            cleaned: document.querySelector('#reader iframe') === null,
          };
        } finally {
          book.destroy();
        }
      });
      assert.deepEqual(result, {
        opaque: true,
        cleaned: true,
        message: { kind: 'packaged', denied: true, name: 'Folio', version, dom: true },
      });
    } finally {
      await browser.close();
    }
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
  }
});
