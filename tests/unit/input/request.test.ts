/** Exercise requests, headers, and failures against a real local HTTP server. */
import { createServer } from 'node:http';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createRequester, HttpError } from '../../../src/index';

const server = createServer((request, response) => {
  if (request.url === '/missing') {
    response.writeHead(404).end('missing');
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify({ header: request.headers['x-test'] ?? 'none' }));
});
let origin = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP server address.');
  }
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
});

test('reads all response types and merges headers', async () => {
  const request = createRequester({ headers: { 'x-test': 'default' } });
  expect(await request(origin, 'json', { headers: { 'x-test': 'override' } })).toEqual({
    header: 'override',
  });
  expect(await request(origin, 'text')).toBe('{"header":"default"}');
  expect(new TextDecoder().decode(await request(origin, 'binary'))).toBe('{"header":"default"}');
  expect(await (await request(origin, 'blob')).text()).toBe('{"header":"default"}');
});

test('reports HTTP status and rejects invalid JSON', async () => {
  const request = createRequester();
  await expect(request(`${origin}/missing`, 'text')).rejects.toMatchObject({
    name: 'HttpError',
    status: 404,
    url: `${origin}/missing`,
  });
  expect(new HttpError(origin, 500)).toBeInstanceOf(Error);
  await expect(request('data:text/plain,invalid', 'json')).rejects.toThrow(SyntaxError);
});

test('passes credentials and signals to a custom network adapter', async () => {
  const controller = new AbortController();
  const request = createRequester({
    credentials: 'include',
    signal: controller.signal,
    fetch: (_url, options) => {
      expect(options?.credentials).toBe('omit');
      expect(options?.signal).toBe(controller.signal);
      return Promise.resolve(new Response('custom'));
    },
  });
  expect(await request(origin, 'text', { credentials: 'omit' })).toBe('custom');
  controller.abort();
  await expect(request(origin, 'text')).rejects.toThrow();
});

test('propagates network errors and cancellation during custom requests', async () => {
  const failure = new Error('network offline');
  const broken = createRequester({ fetch: () => Promise.reject(failure) });
  await expect(broken(origin, 'text')).rejects.toBe(failure);
  const controller = new AbortController();
  const cancelled = createRequester({
    fetch: () => {
      controller.abort();
      return Promise.resolve(new Response('ignored'));
    },
  });
  await expect(cancelled(origin, 'text', { signal: controller.signal })).rejects.toThrow();
});
