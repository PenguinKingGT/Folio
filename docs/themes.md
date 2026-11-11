# Themes and reader styles (F24)

```ts
const reader = book.renderTo('#reader');
await reader.themes.registerRules('default', {
  body: { 'background-color': 'white', color: 'black' },
});
await reader.themes.registerUrl('night', 'styles/night.css');
await reader.themes.select('night');
await reader.display(0);
await reader.themes.font('serif');
await reader.themes.fontSize('120%');
await reader.themes.override('line-height', '1.6', {
  selector: 'p',
  important: true,
});
await reader.themes.removeOverride('line-height');
```

Both bounded and continuous readers expose an independent `themes` manager. `registerCss(name, css, from?)`, `registerUrl(name, url, from?)`, and `registerRules(name, rules)` return promises. The explicit `register(name, source)` form accepts `{ css }`, `{ url }`, or `{ rules }`. Relative references use the OPF by default; `from` supplies another decoded container document path. Registering a stylesheet does not select it, except that `default` always participates in the cascade.

`select(name)` chooses a registered theme. `current` exposes its name and `names` returns an immutable inventory. Styles apply in default → selected → override order. Updating an active registration immediately updates loaded documents. Other mounted readers keep their own preferences. Current chapters, preloaded continuous neighbors, and hidden fixed-layout companions receive styles; subsequent chapter loads inherit the same settings before first layout.

`override(property, value, { selector?, important? })` defaults to `html,body`. `removeOverride(property)` reveals authored/theme styles again. The font helpers target descendants as well as the root so explicit paragraph fonts do not prevent reader preferences. Numeric font sizes are positive CSS pixels; strings accept browser-supported sizes. Relative sizes resolve once at the root, and descendants use that root size without percentage compounding. Normal CSS cascade rules, including author inline `!important`, still apply.

Theme changes reflow while retaining the reading CFI. Currently measurable documents wait for requested fonts before final relayout; hidden frames defer font resolution until first layout/native reflow rather than blocking chapter display. One owned style element sits in each document head. Theme switching adds no body classes or wrappers and does not change structural CFI paths.

CSS imports are read through the book's custom transport and inlined before insertion. Relative asset references retain each imported stylesheet's base. Media, supports, named-layer, and anonymous-layer conditions are preserved. URI traversal checks, archive boundaries, remote-resource policy, and passive CSP remain in force. Remote stylesheet requests require `Book.open(..., { allowRemote: true })`; imported remote assets still obey the passive document's CSP. Theme support never enables publication scripts.

Await mutations in order. A newer registration, selection, or override cancels an older pending theme consumer, including custom fetch implementations that ignore cancellation. `whenIdle()` follows the latest mutation and reports its rejection. Compilation failures retain the last valid registered styles, and later chapter display can still use them. Reader/book destruction cancels pending work and removes owned styles; resource URLs retain book ownership.

Names contain 1–64 ASCII letters, digits, underscores, or hyphens and start with a letter. Up to 64 names include `default`; source and expanded CSS each allow 1,000,000 UTF-16 code units. Imports are cycle-checked and limited to 16 nested stylesheet documents. These limits reject unsupported input before publishing a registration.
