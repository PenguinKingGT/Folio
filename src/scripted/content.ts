/** Prepare explicitly authorized classic scripts in an opaque-origin iframe with embedded assets and restrictive CSP. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { nativeContent } from '../content/document';
import { rewriteAssets } from '../resources/document';
import { bridgeSource } from './bridge';
import { textUrl } from './data';
import { ScriptResources } from './resources';
import type { ScriptedSettings } from './options';

const xhtml = 'http://www.w3.org/1999/xhtml';
const policy =
  "default-src 'none'; script-src data: 'unsafe-inline'; style-src data: 'unsafe-inline'; img-src data:; font-src data:; media-src data:; frame-src 'none'; object-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";

/** Data sources avoid XML/HTML raw-script differences and cannot terminate their containing script element. */
function script(document: Document, code: string): Element {
  const element = document.createElementNS(xhtml, 'script');
  element.setAttribute('src', textUrl(code, 'text/javascript'));
  element.appendChild(document.createTextNode(' '));
  return element;
}

/** Keep execution local while removing embedded browsing contexts, form navigation, and publisher policy overrides. */
function executable(document: Document): void {
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    const name = element.localName.toLowerCase();
    if (
      ['iframe', 'object', 'embed', 'form', 'base'].includes(name) ||
      (name === 'meta' && element.hasAttribute('http-equiv'))
    ) {
      element.remove();
      continue;
    }
    if (name !== 'script') {
      continue;
    }
    const type = (element.getAttribute('type') ?? '').trim().toLowerCase();
    if (type === 'module') {
      throw new TypeError('Scripted views currently support classic scripts, not module graphs.');
    }
    if (type !== '' && !['text/javascript', 'application/javascript'].includes(type)) {
      element.remove();
      continue;
    }
    if (!element.hasAttribute('src')) {
      element.setAttribute('src', textUrl(element.textContent ?? '', 'text/javascript'));
      element.removeAttribute('async');
      element.removeAttribute('defer');
    }
    element.textContent = ' ';
  }
}

/** Encode rewritten stylesheet text as a link so HTML raw-text parsing cannot reinterpret XML escaping. */
function styles(document: Document): void {
  for (const style of Array.from(document.getElementsByTagNameNS(xhtml, 'style'))) {
    const link = document.createElementNS(xhtml, 'link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', textUrl(style.textContent ?? '', 'text/css'));
    for (const key of ['media', 'title']) {
      const value = style.getAttribute(key);
      if (value !== null) {
        link.setAttribute(key, value);
      }
    }
    style.replaceWith(link);
  }
}

/** Section hooks remain headless; native reader hooks cannot access the opaque scripted document. */
export async function scriptedContent(
  book: Book,
  section: Section,
  token: string,
  fragment: string | null,
  settings: ScriptedSettings,
  signal: AbortSignal,
): Promise<string> {
  const { document, root, head } = nativeContent(await section.render(signal));
  executable(document);
  const bootstrap = script(
    document,
    bridgeSource({ token, fragment, name: settings.name, version: settings.version }),
  );
  head.insertBefore(bootstrap, head.firstChild);
  const insertion = bootstrap.nextSibling;
  for (const code of settings.inject) {
    head.insertBefore(script(document, code), insertion);
  }
  const csp = document.createElementNS(xhtml, 'meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', policy);
  head.insertBefore(csp, head.firstChild);
  root.setAttribute('data-folio-document', token);
  const address = book.resources.resolve(section.href);
  if (address.kind !== 'local') {
    throw new TypeError('Scripted chapters require local publication resources.');
  }
  const resources = new ScriptResources(book, signal, settings.maxResourceBytes);
  await rewriteAssets(document, (href) => resources.url(href, address.path));
  signal.throwIfAborted();
  styles(document);
  return '<!DOCTYPE html>' + new XMLSerializer().serializeToString(root);
}
