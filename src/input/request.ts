/** 可注入 Fetch 的请求适配器，统一处理响应、HTTP 错误与取消。 */
export interface ResponseTypes {
  text: string;
  binary: ArrayBuffer;
  blob: Blob;
  json: unknown;
}

/** 请求设置；每次请求的 headers 在默认 headers 上合并覆盖。 */
export interface RequestOptions {
  headers?: HeadersInit;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

/** 自定义网络实现返回标准 Response，可接入认证、缓存或宿主网络层。 */
export interface RequesterOptions extends RequestOptions {
  fetch?: typeof globalThis.fetch;
}

/** 根据期望的响应类型推导返回值，JSON 在边界保留 unknown。 */
export type Requester = <T extends keyof ResponseTypes>(
  url: string,
  type: T,
  options?: RequestOptions,
) => Promise<ResponseTypes[T]>;

/** 带地址与状态码的 HTTP 错误，供上层区分缺失资源和服务器故障。 */
export class HttpError extends Error {
  /** 保留响应状态与原始请求地址，不吞掉网络层异常。 */
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`Request failed (${status}): ${url}`);
    this.name = 'HttpError';
  }
}

/**
 * 创建请求器；默认使用原生 fetch，失败响应及取消请求均拒绝 Promise。
 * @returns 可以重复使用的请求函数。
 */
export function createRequester(defaults: RequesterOptions = {}): Requester {
  const fetcher = defaults.fetch ?? globalThis.fetch.bind(globalThis);
  /** 合并本次设置并转换响应，取消优先于数据交付。 */
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
