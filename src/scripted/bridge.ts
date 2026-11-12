/** Bootstrap an opaque document with a bounded, source-checked message protocol and EPUB reading-system identity. */

/** Configuration contains only host-owned strings and the already resolved optional chapter fragment. */
export interface BridgeConfig {
  token: string;
  fragment: string | null;
  name: string;
  version: string;
}

/** This independent serialized function exposes only features supplied inside the scripted document. */
export function readingSystem(
  config: BridgeConfig,
  scope: Window,
): {
  readonly name: string;
  readonly version: string;
  readonly layoutStyle: string;
  hasFeature(feature: unknown, version?: unknown): boolean | undefined;
} {
  const features = new Set([
    'dom-manipulation',
    'layout-changes',
    'mouse-events',
    'keyboard-events',
    'spine-scripting',
  ]);
  const system = Object.freeze({
    name: config.name,
    version: config.version,
    layoutStyle: 'scrolling',
    hasFeature: (feature: unknown, _version?: unknown): boolean | undefined => {
      // Standard features are versionless; unknown names remain distinguishable from unsupported features.
      if (feature === 'touch-events') {
        return 'ontouchstart' in scope || scope.navigator.maxTouchPoints > 0;
      }
      return typeof feature === 'string' && features.has(feature) ? true : undefined;
    },
  });
  return system;
}

/** This function is serialized into the frame; every dependency must remain local or a browser global. */
export function bootstrap(
  config: BridgeConfig,
  install: typeof readingSystem,
  scope: Window,
): void {
  const send = (type: string, value = '') =>
    scope.parent.postMessage({ folio: config.token, type, value }, '*');
  Object.defineProperty(scope.navigator, 'epubReadingSystem', { value: install(config, scope) });
  Object.defineProperty(scope, 'folio', {
    value: Object.freeze({
      postMessage: (value: unknown) => {
        const json = JSON.stringify(value);
        if (typeof json !== 'string' || json.length > 65_536) {
          throw new RangeError('Publication messages require JSON data of at most 64 KiB.');
        }
        send('message', json);
      },
    }),
  });
  scope.addEventListener(
    'error',
    (event) => {
      send(
        'error',
        typeof event.message === 'string'
          ? event.message.slice(0, 512)
          : 'Publication resource failed to load.',
      );
      event.preventDefault();
    },
    true,
  );
  scope.addEventListener('unhandledrejection', (event) => {
    send('error', 'Unhandled publication promise rejection.');
    event.preventDefault();
  });
  scope.addEventListener(
    'DOMContentLoaded',
    () => {
      if (config.fragment !== null) {
        scope.document.getElementById(config.fragment)?.scrollIntoView();
      }
      send('ready');
    },
    { once: true },
  );
}

/** Serialize the actual compiled bootstrap, ensuring native tests exercise the same code delivered by the package. */
export function bridgeSource(config: BridgeConfig): string {
  return `(${bootstrap.toString()})(${JSON.stringify(config)},${readingSystem.toString()},window);`;
}
