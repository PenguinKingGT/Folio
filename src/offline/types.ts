/** Host-owned persistent store options and connectivity notifications. */

/** Explicit CacheStorage injection supports application-owned storage boundaries without a browser global. */
export interface OfflineOptions {
  storage?: CacheStorage;
  online?: boolean;
  observeConnectivity?: boolean;
}

/** Changes are deduplicated; destruction closes all subscriptions without deleting persistent entries. */
export interface OfflineEventMap {
  online: undefined;
  offline: undefined;
  error: unknown;
  destroyed: undefined;
}
