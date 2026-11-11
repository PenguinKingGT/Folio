/** Reader-scoped themes with validated CSS, deterministic switching, and persistent font/style overrides. */
import type { Book } from '../book/book';
import { withAbort } from '../async/cancellation';
import { ThemeCompiler } from './compiler';
import { ThemeStyles } from './styles';
import { ThemeTasks } from './tasks';
import { serializeOverride } from './rules';
import type { ThemeHost, ThemeSource, ThemeRules, OverrideOptions } from './types';

/** Theme names never become publication classes, selectors, or CFI nodes. */
function themeName(name: string): void {
  if (typeof name !== 'string' || !/^[a-zA-Z][\w-]{0,63}$/.test(name)) {
    throw new TypeError('Invalid theme name.');
  }
}

/** Each reader owns its active theme and style lifetime independently of other mounted readers. */
export class Themes {
  private readonly compiler: ThemeCompiler;
  private readonly styles = new ThemeStyles();
  private readonly tasks = new ThemeTasks();
  private readonly lifetime = new AbortController();
  private readonly registered = new Map<string, string>([['default', '']]);
  private readonly overrides = new Map<string, string>();
  private selected = 'default';

  /** Bind publication resource policy and the reader's loaded-document/layout boundary. */
  constructor(
    book: Book,
    private readonly host: ThemeHost,
  ) {
    this.compiler = new ThemeCompiler(book);
  }

  /** Return the currently selected named theme; the default stylesheet always also applies. */
  get current(): string {
    return this.selected;
  }

  /** Return registered names without exposing mutable registration state. */
  get names(): readonly string[] {
    return Object.freeze(Array.from(this.registered.keys()));
  }

  /** Register explicit CSS, URL, or rule inputs; an active registration updates loaded documents. */
  register(name: string, source: ThemeSource): Promise<void> {
    return this.tasks.run(async (signal) => {
      themeName(name);
      if (!this.registered.has(name) && this.registered.size >= 64) {
        throw new RangeError('Too many registered themes.');
      }
      const css = await this.compiler.compile(source, signal);
      signal.throwIfAborted();
      this.registered.set(name, css);
      if (name === 'default' || name === this.selected) {
        await this.update(signal);
      }
    });
  }

  /** Register literal CSS; resources resolve against the OPF unless a source path is supplied. */
  registerCss(name: string, css: string, from?: string): Promise<void> {
    return this.register(name, { css, ...(from === undefined ? {} : { from }) });
  }

  /** Read a stylesheet through the book's configured archive/network transport. */
  registerUrl(name: string, url: string, from?: string): Promise<void> {
    return this.register(name, { url, ...(from === undefined ? {} : { from }) });
  }

  /** Register selector/property maps without unsafe declaration or selector interpolation. */
  registerRules(name: string, rules: ThemeRules): Promise<void> {
    return this.register(name, { rules });
  }

  /** Switch only to a known theme, retain overrides, await requested fonts, and preserve the reading anchor. */
  select(name: string): Promise<void> {
    return this.tasks.run(async (signal) => {
      if (!this.registered.has(name)) {
        throw new RangeError('Unknown theme.');
      }
      this.selected = name;
      await this.update(signal);
    });
  }

  /** Apply a validated scoped property after default/selected stylesheets. */
  override(property: string, value: string, options: OverrideOptions = {}): Promise<void> {
    return this.setOverride(property, () => serializeOverride(property, value, options));
  }

  /** Compile overrides before changing the cascade so malformed values retain the last valid preference. */
  private setOverride(property: string, css: () => string): Promise<void> {
    return this.tasks.run(async (signal) => {
      const compiled = await this.compiler.compile({ css: css() }, signal);
      signal.throwIfAborted();
      this.overrides.set(property, compiled);
      await this.update(signal);
    });
  }

  /** Remove one reader override, revealing the active theme and authored cascade. */
  removeOverride(property: string): Promise<void> {
    return this.tasks.run(async (signal) => {
      if (this.overrides.delete(property)) {
        await this.update(signal);
      }
    });
  }

  /** Override all text descendants so explicit author paragraph fonts do not block a reader preference. */
  font(family: string): Promise<void> {
    return this.override('font-family', family, { important: true, selector: 'html,body,body *' });
  }

  /** Numbers denote positive CSS pixels; strings accept browser-supported font-size values. */
  async fontSize(size: number | string): Promise<void> {
    if (typeof size === 'number' && (!Number.isFinite(size) || size <= 0)) {
      throw new RangeError('Font size must be positive and finite.');
    }
    const value = typeof size === 'number' ? `${size}px` : size;
    if (globalThis.CSS !== undefined && !CSS.supports('font-size', value)) {
      throw new TypeError('Invalid font size.');
    }
    // Resolve relative sizes once at the root; applying percentages to every descendant compounds them.
    await this.setOverride(
      'font-size',
      () =>
        serializeOverride('font-size', value, { important: true, selector: 'html' }) +
        serializeOverride('font-size', '1rem', { important: true, selector: 'body,body *' }),
    );
  }

  /** Style a new chapter before its first layout; superseding mutations cannot leave a stale theme behind. */
  async apply(document: Document, consumer?: AbortSignal): Promise<void> {
    const signal =
      consumer === undefined
        ? this.lifetime.signal
        : AbortSignal.any([consumer, this.lifetime.signal]);
    let version: number;
    do {
      await withAbort(this.tasks.settled(), signal);
      version = this.tasks.version;
      this.styles.apply(document, this.css());
      await this.styles.fonts(document, signal);
    } while (version !== this.tasks.version);
  }

  /** Await the most recent registration, selection, or override request. */
  whenIdle(): Promise<void> {
    return this.tasks.whenIdle();
  }

  /** Combine base, selected theme, and explicit overrides in deterministic cascade order. */
  private css(): string {
    const base = this.registered.get('default') ?? '';
    const selected = this.selected === 'default' ? '' : (this.registered.get(this.selected) ?? '');
    return `${base}\n${selected}\n${Array.from(this.overrides.values()).join('\n')}`;
  }

  /** Apply all styles synchronously before awaiting fonts, then perform one reader layout. */
  private async update(signal: AbortSignal): Promise<void> {
    const documents = this.host.documents();
    const css = this.css();
    for (const document of documents) {
      this.styles.apply(document, css);
    }
    await Promise.all(documents.map((document) => this.styles.fonts(document, signal)));
    signal.throwIfAborted();
    if (documents.length > 0) {
      this.host.layout();
    }
  }

  /** Abort pending mutations and remove owned styles without initiating another reader layout. */
  destroy(): void {
    this.lifetime.abort();
    this.tasks.destroy();
    for (const document of this.host.documents()) {
      this.styles.remove(document);
    }
    this.registered.clear();
    this.overrides.clear();
  }
}
