/** Legacy Apple display preferences remain separate from explicit host execution or device permissions. */

export type ApplePlatform = '*' | 'ipad' | 'iphone';

/** Null distinguishes an absent preference from an explicitly false setting. */
export interface AppleDisplayOptions {
  readonly fixedLayout: boolean | null;
  readonly openToSpread: boolean | null;
  readonly interactive: boolean | null;
  readonly orientationLock: 'none' | 'portrait-only' | 'landscape-only' | null;
}
