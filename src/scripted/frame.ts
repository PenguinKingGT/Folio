/** Own an opaque-origin executable iframe, bounded readiness handshake, and source-checked host notifications. */
import { setDimension } from '../render/surface';
import { scriptMessage } from './protocol';
import type { ScriptMessage } from './protocol';
import type { ScriptedOptions, ScriptedSettings } from './options';

/** This surface deliberately has no native Document API because scripts never share the host origin. */
export class ScriptedFrame {
  readonly frame: HTMLIFrameElement;
  private readonly window: Window;
  private readonly listener: (event: MessageEvent<unknown>) => void;
  private readonly timeout: number;
  private controller: AbortController | undefined;
  private token: string | null = null;
  private ready: (() => void) | undefined;
  private destroyed = false;

  /** Allocate only after explicit permissions are validated by the reader. */
  constructor(
    container: HTMLElement,
    options: ScriptedOptions,
    settings: ScriptedSettings,
    notify: (message: Exclude<ScriptMessage, { type: 'ready' }>) => void,
  ) {
    const window = container.ownerDocument.defaultView;
    if (
      window === null ||
      !container.isConnected ||
      container.namespaceURI !== 'http://www.w3.org/1999/xhtml'
    ) {
      throw new TypeError('Scripted views require an attached browser HTML container.');
    }
    this.window = window;
    this.timeout = settings.timeout;
    this.frame = container.ownerDocument.createElement('iframe');
    this.frame.setAttribute(
      'sandbox',
      settings.popups ? 'allow-scripts allow-popups' : 'allow-scripts',
    );
    this.frame.setAttribute('allow', "camera 'none'; microphone 'none'; geolocation 'none'");
    this.frame.title = 'Scripted EPUB content';
    this.frame.referrerPolicy = 'no-referrer';
    this.frame.style.border = '0';
    setDimension(this.frame, 'width', options.width ?? '100%');
    setDimension(this.frame, 'height', options.height ?? '100%');
    this.frame.hidden = true;
    this.listener = (event) => {
      if (
        this.token === null ||
        event.source !== this.frame.contentWindow ||
        event.origin !== 'null'
      ) {
        return;
      }
      const message = scriptMessage(event.data, this.token);
      if (message?.type === 'ready') {
        this.ready?.();
      } else if (message !== null) {
        notify(message);
      }
    };
    window.addEventListener('message', this.listener);
    container.appendChild(this.frame);
  }

  /** Cancel the previous session before preparing another document or destroying the surface. */
  stop(): void {
    this.token = null;
    this.controller?.abort();
    this.frame.hidden = true;
    this.frame.style.visibility = 'hidden';
    this.frame.srcdoc = '<!DOCTYPE html><title>Inactive EPUB view</title>';
  }

  /** Wait for the bootstrap belonging to this exact document; stale and unrelated frame messages cannot complete it. */
  load(source: string, token: string, signal: AbortSignal): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('Scripted frame has been destroyed.'));
    }
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    const combined = AbortSignal.any([signal, controller.signal]);
    combined.throwIfAborted();
    this.token = token;
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        combined.removeEventListener('abort', aborted);
        this.ready = undefined;
      };
      const fail = (error: unknown) => {
        cleanup();
        this.token = null;
        reject(error);
      };
      const aborted = () => fail(combined.reason);
      const timer = setTimeout(
        () => fail(new Error('Scripted chapter readiness timed out.')),
        this.timeout,
      );
      this.ready = () => {
        cleanup();
        resolve();
      };
      combined.addEventListener('abort', aborted, { once: true });
      // Publisher initialization may measure styles before ready; Firefox needs a measurable frame.
      this.frame.style.visibility = 'hidden';
      this.frame.hidden = false;
      this.frame.style.display = 'block';
      this.frame.srcdoc = source;
    });
  }

  /** Make the ready opaque surface visible without attempting cross-origin DOM access. */
  show(): void {
    this.frame.hidden = false;
    this.frame.style.display = 'block';
    this.frame.style.visibility = '';
  }

  /** Remove the frame, native message listener, and all pending readiness waits; safe to repeat. */
  destroy(): void {
    if (!this.destroyed) {
      this.stop();
      this.destroyed = true;
      this.window.removeEventListener('message', this.listener);
      this.frame.remove();
    }
  }
}
