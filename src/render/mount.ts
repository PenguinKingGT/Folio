/** Resolve reader selectors only when a host browser DOM exists. */

/** Require an existing HTML container while leaving attachment validation to the view. */
export function mountTarget(target: HTMLElement | string): HTMLElement {
  if (typeof target !== 'string') {
    return target;
  }
  if (typeof document === 'undefined') {
    throw new TypeError('Rendering requires a browser document.');
  }
  const element = document.querySelector<HTMLElement>(target);
  if (element === null) {
    throw new TypeError(`Reader container not found: ${target}`);
  }
  return element;
}
