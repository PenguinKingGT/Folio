/** Follow native browser connectivity without requiring window or navigator in headless environments. */

/** Native online/offline events supply the transition; host-set status can use the same update operation. */
export function observeConnectivity(update: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const online = () => update(true);
  const offline = () => update(false);
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  return () => {
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
  };
}
