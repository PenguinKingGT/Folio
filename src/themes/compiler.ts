/** Compile themes headlessly, resolving imports and assets through the publication's existing resource policy. */
import parse from 'css-tree/parser';
import generate from 'css-tree/generator';
import type { Book } from '../book/book';
import { rewriteCss } from '../resources/css';
import { importReference, importConditions } from './imports';
import { serializeRules } from './rules';
import type { ThemeSource } from './types';
import { withAbort } from '../async/cancellation';

const maximumCss = 1_000_000;

/** Normalize URI references while preserving decoded publication path semantics. */
function relative(href: string, from: string): string {
  return /^https?:\/\//i.test(from) ? new URL(href, from).href : href;
}

/** Theme compilation owns no DOM, network credentials, or resource URL lifetime. */
export class ThemeCompiler {
  /** Reuse custom transport, archive limits, cancellation, and default-denied remote resources. */
  constructor(private readonly book: Book) {}

  /** Compile an explicit CSS/rules/URL source before changing a registered theme. */
  async compile(source: ThemeSource, signal: AbortSignal): Promise<string> {
    const from = source.from ?? this.book.packagePath;
    if ('url' in source) {
      return this.load(source.url, from, signal, new Set());
    }
    return this.css(
      'css' in source ? source.css : serializeRules(source.rules),
      from,
      signal,
      new Set(),
    );
  }

  /** Reject cyclic or excessively deep imports before reading their content. */
  private async load(
    href: string,
    from: string,
    signal: AbortSignal,
    parents: ReadonlySet<string>,
  ): Promise<string> {
    signal.throwIfAborted();
    const reference = relative(href, from);
    const address = this.book.resources.resolve(reference, from);
    if (address.kind === 'fragment' || address.kind === 'inline') {
      throw new TypeError('Theme stylesheets require a publication path or allowed HTTP URL.');
    }
    const path = address.kind === 'local' ? address.path : address.url;
    if (parents.has(path) || parents.size >= 16) {
      throw new RangeError('Cyclic or excessively deep theme CSS imports.');
    }
    // Custom fetch producers may ignore AbortSignal; the theme consumer must still cancel promptly.
    const text = await withAbort(this.book.text(reference, from, signal), signal);
    return this.css(text, path, signal, new Set([...parents, path]));
  }

  /** Inline imports before DOM insertion so passive WebKit frames need no stylesheet callbacks. */
  private async css(
    source: string,
    from: string,
    signal: AbortSignal,
    parents: ReadonlySet<string>,
  ): Promise<string> {
    signal.throwIfAborted();
    if (typeof source !== 'string' || source.length > maximumCss) {
      throw new RangeError('Theme CSS exceeds the supported size.');
    }
    const ast = parse(source, {
      onParseError: (error) => {
        throw error;
      },
    });
    if (ast.type !== 'StyleSheet') {
      throw new TypeError('Invalid theme stylesheet.');
    }
    let css = '';
    for (const node of ast.children) {
      if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') {
        const { href, qualifiers } = importReference(node);
        css += importConditions(await this.load(href, from, signal, parents), qualifiers);
      } else if (node.type !== 'Atrule' || node.name.toLowerCase() !== 'charset') {
        css += await rewriteCss(generate(node), (href) =>
          this.book.resources.url(relative(href, from), from, signal),
        );
      }
      signal.throwIfAborted();
      if (css.length > maximumCss) {
        throw new RangeError('Expanded theme CSS exceeds the supported size.');
      }
    }
    return css;
  }
}
