/** Native Fetch decompresses bodies before the reader applies its independent decoded-byte limit. */
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { createRequester } from '../../../src/index';

const payload = 'Original'.repeat(100);
const compressed = gzipSync(payload);

/** Serve compressed content with its truthful compressed Content-Length, which must not bypass decoded limits. */
function serve(): ReturnType<typeof createServer> {
  return createServer((_request, response) => {
    response.writeHead(200, { 'content-encoding': 'gzip', 'content-length': compressed.length });
    response.end(compressed);
  });
}

test('counts decompressed bytes and still permits a subsequent request with a larger explicit limit', async () => {
  const server = serve();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected a TCP address.');
    }
    const url = `http://127.0.0.1:${address.port}/original`;
    const request = createRequester({ maxResponseBytes: 128 });
    expect(compressed.length).toBeLessThan(128);
    await expect(request(url, 'text')).rejects.toThrow('Decoded response');
    expect(await request(url, 'text', { maxResponseBytes: payload.length })).toBe(payload);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
  }
});
