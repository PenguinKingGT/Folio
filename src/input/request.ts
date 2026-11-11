/** Injectable Fetch adapter with consistent responses, HTTP errors, and cancellation. */
export interface ResponseTypes {
  text: string;
  binary: ArrayBuffer;
  blob: Blob;
  json: unknown;
}

/** Per-request settings; matching headers override defaults. */
export interface RequestOptions {
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

/** Custom transports return a standard Response for authentication, caching, or host integration. */
export interface RequesterOptions extends RequestOptions {
  fetch?: typeof globalThis.fetch;
}

/** Infer result types from response selectors; keep external JSON unknown. */
export type Requester = <T extends keyof ResponseTypes>(
  url: string,
  type: T,
  options?: RequestOptions,
) => Promise<ResponseTypes[T]>;

/** HTTP failure retaining URL and status for caller-side error handling. */
export class HttpError extends Error {
  /** Preserve response status and the original request address. */
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`Request failed (${status}): ${url}`);
    this.name = 'HttpError';
  }
}

/**
 * Create a requester using native fetch by default; failures and cancellation reject.
 * @returns A reusable request function.
 */
export function createRequester(defaults: RequesterOptions = {}): Requester {
  const fetcher = defaults.fetch ?? globalThis.fetch.bind(globalThis);
  /** Merge settings and decode the response, giving cancellation priority over delivery. */
  return async <T extends keyof ResponseTypes>(
    url: string,
    type: T,
    options: RequestOptions = {},
  ): Promise<ResponseTypes[T]> => {
    const headers = new Headers(defaults.headers);
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    const signal = options.signal ?? defaults.signal;
    signal?.throwIfAborted();
    const response = await fetcher(url, {
      headers,
      credentials: options.credentials ?? defaults.credentials ?? 'same-origin',
      ...(signal === undefined ? {} : { signal }),
    });
    signal?.throwIfAborted();
    if (!response.ok) {
      throw new HttpError(url, response.status);
    }
    const readers: { [K in keyof ResponseTypes]: () => Promise<ResponseTypes[K]> } = {
      text: (): Promise<string> => response.text(),
      binary: (): Promise<ArrayBuffer> => response.arrayBuffer(),
      blob: (): Promise<Blob> => response.blob(),
      json: (): Promise<unknown> => response.json(),
    };
    const result = await readers[type]();
    signal?.throwIfAborted();
    return result;
  };
}
