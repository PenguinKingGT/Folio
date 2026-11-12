/** Explicitly authorized chapter scripting with opaque-origin isolation and host-owned navigation/lifecycle. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { resolveDisplayTarget } from '../render/target';
import { mountTarget } from '../render/mount';
import { EventEmitter } from '../events/emitter';
import { isAbortError, disposeAll } from '../async/lifecycle';
import { withAbort } from '../async/cancellation';
import { ScriptedFrame } from './frame';
import { scriptedSettings } from './options';
import type { ScriptedOptions, ScriptedSettings, ScriptedTarget } from './options';
import { scriptedContent } from './content';

/** Notifications never grant privileged host operations to a publisher message. */
export interface ScriptedEventMap {
  displayed: Section;
  message: unknown;
  error: unknown;
  destroyed: undefined;
}

/** Passive DOM measurement APIs are unavailable in this separate, executable reading mode. */
export class ScriptedReader extends EventEmitter<ScriptedEventMap> {
  private readonly view: ScriptedFrame;
  private readonly settings: ScriptedSettings;
  private controller: AbortController | undefined;
  private current: Section | null = null;
  private destroyed = false;
  private failure: unknown = null;

  /** Explicit scripts:true permission is required before allocation, injection, or chapter I/O. */
  constructor(
    private readonly book: Book,
    target: HTMLElement | string,
    options: ScriptedOptions,
    private readonly onDestroy?: () => void,
  ) {
    super();
    this.settings = scriptedSettings(options);
    this.view = new ScriptedFrame(mountTarget(target), options, this.settings, (message) => {
      if (message.type === 'message') {
        this.emit('message', message.value);
      } else {
        this.report(new Error(`Scripted publication: ${message.value}`));
      }
    });
  }

  /** The opaque iframe is exposed for host sizing; contentDocument remains inaccessible. */
  get frame(): HTMLIFrameElement {
    return this.view.frame;
  }
  /** Return the active successfully displayed section, or null while loading/after failure. */
  get currentSection(): Section | null {
    return this.current;
  }
  /** Retain the most recent publisher or display failure until a new display starts. */
  get lastError(): unknown {
    return this.failure;
  }
  /** Opaque execution provides no same-origin native Document or Range capability. */
  getContents(): null {
    this.assertActive();
    return null;
  }

  /** Display a chapter/href/anchor; precise native CFI/percentage seeking belongs to passive readers. */
  async display(target?: ScriptedTarget): Promise<Section> {
    this.assertActive();
    const current = this.current;
    this.controller?.abort();
    this.view.stop();
    const controller = new AbortController();
    this.controller = controller;
    this.failure = null;
    this.current = null;
    try {
      if (
        (typeof target === 'object' && target !== null && 'percentage' in target) ||
        (typeof target === 'string' && /^#?epubcfi\(/u.test(target))
      ) {
        throw new TypeError(
          'Scripted views support chapter/href/anchor navigation, not native CFI or percentage seeking.',
        );
      }
      const resolved = await resolveDisplayTarget(this.book, current, target, controller.signal);
      const token = crypto.randomUUID();
      const source = await withAbort(
        scriptedContent(
          this.book,
          resolved.section,
          token,
          resolved.fragment,
          this.settings,
          controller.signal,
        ),
        controller.signal,
      );
      controller.signal.throwIfAborted();
      await this.view.load(source, token, controller.signal);
      controller.signal.throwIfAborted();
      this.current = resolved.section;
      this.view.show();
      this.emit('displayed', resolved.section);
      return resolved.section;
    } catch (error) {
      if (this.controller === controller && !controller.signal.aborted) {
        this.view.stop();
        this.report(error);
      }
      throw error;
    }
  }

  /** Advance to the next linear chapter instead of attempting host measurement inside an opaque origin. */
  next(): Promise<Section | null> {
    return this.turn('next');
  }
  /** Return to the previous linear chapter. */
  prev(): Promise<Section | null> {
    return this.turn('previous');
  }
  /** Resolve relative chapter navigation using the same immutable reading order as passive readers. */
  private async turn(direction: 'next' | 'previous'): Promise<Section | null> {
    this.assertActive();
    if (this.current === null) {
      return this.display();
    }
    const target = this.book.spine.adjacent(this.current.index, direction);
    return target === null ? null : this.display(target.index);
  }

  /** Ignore expected cancellation and suppress notifications after terminal destruction. */
  private report(error: unknown): void {
    if (!this.destroyed && !isAbortError(error)) {
      this.failure = error;
      this.emit('error', error);
    }
  }
  /** Stop executable content and release all pending operations/listeners; safe to repeat. */
  destroy(): void {
    if (!this.destroyed) {
      this.destroyed = true;
      this.controller?.abort();
      this.view.destroy();
      this.current = null;
      disposeAll([() => this.onDestroy?.(), () => this.finishEvents('destroyed', undefined)]);
    }
  }
  /** Reject APIs consistently after either reader or book destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Scripted reader has been destroyed.');
    }
  }
}
