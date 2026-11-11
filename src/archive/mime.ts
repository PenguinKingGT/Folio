/** MIME types for common EPUB assets; unknown files remain binary. */
const types: Readonly<Record<string, string>> = {
  xhtml: 'application/xhtml+xml',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  xml: 'application/xml',
  opf: 'application/oebps-package+xml',
  ncx: 'application/x-dtbncx+xml',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  js: 'text/javascript',
  json: 'application/json',
  txt: 'text/plain',
};

/** Infer MIME from an extension; Blob and URL methods accept explicit overrides. */
export function mimeType(path: string): string {
  return types[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] ?? 'application/octet-stream';
}
