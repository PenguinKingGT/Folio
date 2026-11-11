# 输入与请求（F01）

`resolveInput(input, options?)` 将输入规范化为归档字节或地址，供后续加载模块使用；此函数不执行解压或 OPF 解析。

- 支持 `string`、`URL`、`ArrayBuffer`、`Uint8Array`；二进制数据按视图范围复制。
- 自动识别 `.epub`、`.opf`、`.json`（忽略大小写、查询参数和片段），其他地址视为解压目录。
- `type` 可显式指定 `epub`、`opf`、`json`、`directory`、`base64`。Base64 必须显式声明。
- `baseUrl` 用于解析相对地址；默认保留相对地址，交给请求环境解析。
- 地址允许 HTTP、HTTPS、Blob 协议；空输入、非法 Base64 和二进制类型冲突抛出 `TypeError`。

`createRequester(options?)` 返回 `request(url, responseType, options?)`：

```ts
import { createRequester, resolveInput } from 'folio-epub';

const source = resolveInput('/books/alice.epub');
const request = createRequester({
  headers: { Authorization: 'Bearer …' },
  credentials: 'same-origin',
});

if (source.type === 'epub') {
  const bytes = await request(source.url, 'binary');
  // bytes 为 ArrayBuffer，交给归档模块。
}
```

响应类型为 `text`、`binary`、`blob`、`json`；JSON 返回 `unknown`，调用方需校验结构。自定义网络实现通过 `fetch` 选项注入并返回标准 `Response`。

每次请求的 headers 覆盖同名默认头，credentials 和 signal 可单独覆盖。HTTP 非成功响应抛出带 `url`、`status` 的 `HttpError`；网络、解码和取消异常向调用方传播。请求器在请求前、收到响应后及读取响应体后检查取消状态，即使自定义适配器忽略 signal 也不交付取消结果。
