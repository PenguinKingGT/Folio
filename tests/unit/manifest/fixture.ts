/** Original JSON publications reuse authored chapter assets while keeping metadata and navigation format-specific. */
import { bookFiles } from '../book/fixture';

/** A nested inline directory, cover relationship, and nonlinear middle item exercise the full normalized model. */
export function jsonManifest(): Record<string, unknown> {
  return {
    metadata: {
      identifier: 'original-json',
      title: 'Original JSON',
      language: ['en', 'zh'],
      author: [{ name: 'Original Author' }],
      description: '',
      readingProgression: 'ltr',
    },
    readingOrder: [
      { id: 'chapter', href: 'text/chapter%20one.xhtml', type: 'application/xhtml+xml' },
      { id: 'notes', href: 'notes.xhtml', linear: false },
      { id: 'last', href: 'last.xhtml', linear: 'yes' },
    ],
    resources: [{ id: 'cover', href: 'images/cover.jpg', type: 'image/jpeg', rel: ['cover'] }],
    toc: [
      {
        id: 'group',
        title: 'Original part',
        children: [
          { id: 'entry', title: 'Original chapter', href: 'text/chapter%20one.xhtml#start' },
          { title: 'Last chapter', href: 'last.xhtml#end' },
        ],
      },
    ],
    landmarks: [{ title: 'Start', href: 'text/chapter%20one.xhtml', rel: ['bodymatter'] }],
    pageList: [{ title: '1', href: 'text/chapter%20one.xhtml#start' }],
  };
}

/** No XML package/container is needed for the JSON source; relative assets still use its document path. */
export function jsonFiles(): Map<string, string> {
  const files = bookFiles();
  files.set('OPS/manifest.json', JSON.stringify(jsonManifest()));
  files.set(
    'OPS/text/chapter one.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p id="start">Original <em>JSON</em> chapter</p><script>window.untrustedJson=true;</script></body></html>',
  );
  files.set(
    'OPS/notes.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original note</p></body></html>',
  );
  files.set(
    'OPS/last.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p id="end">Original ending</p></body></html>',
  );
  return files;
}

/** Return native Responses through the injectable transport and retain decoded request paths for lazy-load assertions. */
export function jsonTransport(files = jsonFiles()): {
  fetch: typeof fetch;
  calls: readonly string[];
} {
  const calls: string[] = [];
  return {
    calls,
    fetch: (input, init) => {
      const request = new Request(input, init);
      const path = decodeURIComponent(new URL(request.url).pathname.slice(1));
      calls.push(path);
      const source = files.get(path);
      return Promise.resolve(
        new Response(source ?? 'missing', { status: source === undefined ? 404 : 200 }),
      );
    },
  };
}
