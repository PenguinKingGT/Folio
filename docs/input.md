# Input and requests (F01)

`resolveInput(input, options?)` normalizes an input into archive bytes or a resource URL. It does not decompress archives or parse package documents.

- Accepts strings, `URL`, `ArrayBuffer`, and `Uint8Array`; copies only the selected binary view.
- Recognizes `.epub`, `.opf`, and `.json` regardless of case, query, or fragment. Other addresses represent extracted directories.
- Explicit `type`: `epub`, `opf`, `json`, `directory`, or `base64`. Base64 requires an explicit type.
- `baseUrl` resolves relative addresses; otherwise relative addresses are preserved for the request environment.
- HTTP, HTTPS, and Blob URLs are accepted. Empty input, invalid Base64, and conflicting binary types throw `TypeError`.

`createRequester(options?)` returns `request(url, responseType, options?)`:

```ts
import { createRequester, resolveInput } from 'folio-epub';

const source = resolveInput('/books/alice.epub');
const request = createRequester({ credentials: 'same-origin' });
if (source.type === 'epub') {
  const bytes = await request(source.url, 'binary');
  // Pass this ArrayBuffer to the archive module.
}
```

Response types are `text`, `binary`, `blob`, and `json`. JSON returns `unknown` and requires validation. Inject a custom network implementation through `fetch`, returning a standard `Response`.

Per-request headers override matching defaults; credentials can be overridden separately. Default and per-call signals are combined, so either can cancel the request. Unsuccessful HTTP responses throw `HttpError` with `url` and `status`. Network, decoding, and cancellation failures propagate. Cancellation is checked before requesting, after receiving a response, and after reading its body, including when a custom adapter ignores the signal.

`maxResponseBytes` defaults to 64 MiB and must be a positive safe integer. A per-request value overrides the requester default. Response readers enforce decoded bytes independently of `Content-Length`, cap chunks at 65,536, and cancel/release oversized or aborted streams. Network container, OPF and JSON markup use strict UTF-8 decoding. See [security boundaries](./security.md).
