/** Open ZIP, extracted-directory, and OPF sources behind a common byte provider. */
import { Archive } from '../archive/archive';
import { validateArchivePath } from '../archive/path';
import { parseContainer } from '../container/container';
import { createRequester } from '../input/request';
import type { Requester } from '../input/request';
import { resolveInput } from '../input/source';
import type { ResourceReader } from '../resources/resources';
import type { BookOptions } from './options';

/** Open publication source with its own cancellation and resource lifetime. */
export interface PublicationSource {
  packagePath: string;
  packageXml: string;
  read: ResourceReader;
  request: Requester;
  signal: AbortSignal;
  destroy: () => void;
}

/** Convert decoded container paths to URL path segments without altering encoded filenames. */
function encodePath(path: string): string {
  return validateArchivePath(path).split('/').map(encodeURIComponent).join('/');
}

/** Build an archive provider and release it if container/package discovery fails. */
function archiveSource(
  data: ArrayBuffer | Uint8Array,
  options: BookOptions,
  request: Requester,
  controller: AbortController,
  signal: AbortSignal,
): PublicationSource {
  const archive = new Archive(data, options.archiveLimits);
  try {
    const { packagePath } = parseContainer(archive.getText('META-INF/container.xml'));
    return {
      packagePath,
      packageXml: archive.getText(packagePath),
      request,
      signal,
      read: (path, consumer) => {
        AbortSignal.any([signal, consumer]).throwIfAborted();
        return Promise.resolve(archive.getBytes(path));
      },
      destroy: () => {
        controller.abort();
        archive.destroy();
      },
    };
  } catch (error) {
    archive.destroy();
    throw error;
  }
}

/** Discover OPF relative to a directory container, or use a direct OPF URL as given. */
async function networkSource(
  url: URL,
  directory: boolean,
  request: Requester,
  controller: AbortController,
  signal: AbortSignal,
): Promise<PublicationSource> {
  let root = new URL('/', url);
  let packagePath = decodeURIComponent(url.pathname.slice(1));
  let packageUrl = url;
  if (directory) {
    if (!url.pathname.endsWith('/')) {
      url.pathname += '/';
    }
    root = url;
    const xml = await request(new URL('META-INF/container.xml', root).href, 'text', { signal });
    packagePath = parseContainer(xml).packagePath;
    packageUrl = new URL(encodePath(packagePath), root);
  }
  const packageXml = await request(packageUrl.href, 'text', { signal });
  return {
    packagePath,
    packageXml,
    request,
    signal,
    read: async (path, consumer) =>
      new Uint8Array(
        await request(new URL(encodePath(path), root).href, 'binary', {
          signal: AbortSignal.any([signal, consumer]),
        }),
      ),
    destroy: () => controller.abort(),
  };
}

/** Resolve an input and open its byte source; JSON manifests are implemented separately in F31. */
export async function openSource(
  input: string | URL | ArrayBuffer | Uint8Array,
  options: BookOptions,
): Promise<PublicationSource> {
  const controller = new AbortController();
  const signal =
    options.signal === undefined
      ? controller.signal
      : AbortSignal.any([controller.signal, options.signal]);
  signal.throwIfAborted();
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const request = createRequester({
    ...options,
    fetch: options.offline === undefined ? fetcher : options.offline.wrap(fetcher),
  });
  const source = resolveInput(input, options);
  try {
    if (source.type === 'binary') {
      return archiveSource(source.data, options, request, controller, signal);
    }
    if (source.type === 'json') {
      throw new TypeError('JSON manifests are not implemented yet (F31).');
    }
    const base = typeof location === 'undefined' ? undefined : location.href;
    const url = new URL(source.url, base);
    if (source.type === 'epub') {
      return archiveSource(
        await request(url.href, 'binary', { signal }),
        options,
        request,
        controller,
        signal,
      );
    }
    return await networkSource(url, source.type === 'directory', request, controller, signal);
  } catch (error) {
    controller.abort();
    throw error;
  }
}
