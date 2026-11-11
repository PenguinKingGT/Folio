/** 将调用方输入规范化为归档字节或可请求的书籍地址。 */
export type InputType = 'epub' | 'opf' | 'directory' | 'json' | 'base64';

/** 输入支持显式指定类型；Base64 必须显式声明，避免将地址误判为归档。 */
export interface InputOptions {
  type?: InputType;
  baseUrl?: string;
}

/** 规范化后的输入，解析与解压模块通过判别字段消费。 */
export type BookSource =
  | { type: 'binary'; data: Uint8Array }
  | { type: 'epub' | 'opf' | 'directory' | 'json'; url: string };

/**
 * 识别输入；复制二进制数据以避免调用方后续修改影响加载结果。
 * @throws TypeError 输入为空、类型冲突或 Base64 非法。
 */
export function resolveInput(
  input: string | URL | ArrayBuffer | Uint8Array,
  options: InputOptions = {},
): BookSource {
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    if (options.type !== undefined) {
      throw new TypeError('Binary input cannot specify a text input type.');
    }
    return { type: 'binary', data: new Uint8Array(input).slice() };
  }
  const value = input.toString().trim();
  if (value.length === 0) {
    throw new TypeError('Book input cannot be empty.');
  }
  if (options.type === 'base64') {
    return { type: 'binary', data: decodeBase64(value) };
  }
  const url = options.baseUrl === undefined ? value : new URL(value, options.baseUrl).href;
  if (/^[a-z][a-z\d+.-]*:/i.test(url) && !/^(https?:|blob:)/i.test(url)) {
    throw new TypeError('Unsupported book URL protocol.');
  }
  return { type: options.type ?? inferType(url), url };
}

/** 仅检查路径扩展名，避免查询参数和片段改变输入识别结果。 */
function inferType(url: string): 'epub' | 'opf' | 'json' | 'directory' {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  const extension = /\.(epub|opf|json)$/i.exec(path)?.[1]?.toLowerCase();
  if (extension === 'epub' || extension === 'opf' || extension === 'json') {
    return extension;
  }
  return 'directory';
}

/** 严格解码标准 Base64；允许 MIME 中常见的 ASCII 空白及省略尾部填充。 */
function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/[\t\n\r ]/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new TypeError('Invalid Base64 input.');
  }
  try {
    const decoded = atob(normalized);
    if (decoded.length === 0) {
      throw new TypeError('Empty Base64 input.');
    }
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch (cause) {
    throw new TypeError('Invalid Base64 input.', { cause });
  }
}
