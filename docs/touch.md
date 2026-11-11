# Touch navigation (F23)

```ts
const reader = book.renderTo('#reader', {
  touch: { minDistance: 32, maxDurationMs: 800, axisRatio: 1.5 },
});
await reader.display();

// Optional caller-owned touch panel, outside the publication iframe.
const panel = document.querySelector<HTMLElement>('#turn-panel');
if (panel) {
  const release = reader.touch.bind(panel);
  await reader.touch.whenIdle();
  release();
}
```

Use `touch: true` for defaults; touch handling is disabled by default. Positive finite distances and durations are required, and `axisRatio` must be at least one. Distances use CSS pixels and durations use milliseconds. A dominant swipe turns one page or spread along the effective pagination axis and reading direction, including RTL and vertical writing. Fixed pages use horizontal progression. Repeated contacts during a pending turn coalesce into the accepted turn.

Taps, short/diagonal swipes, long presses, mouse/pen input, pointer cancellation, and multi-touch do not turn pages. Existing selections, selection created during a contact, links, controls, editable content, and nested scroll regions retain native interaction. Reader-owned `touch-action` declarations allow cross-axis panning and pinch zoom. Book content stays passive; touch support never enables publication scripts.

Paginated document `scrollend` events snap to the nearest reachable spread. `reader.touch.snap()` explicitly requests the same operation. Natural document and continuous scrolling remain native and do not acquire page-turn or snapping gestures. Mode/layout changes invalidate old gesture geometry. Chapter replacement and reader destruction release listeners; cleanup restores owned style declarations without overwriting later host overrides.

`reader.touch.bind(surface)` binds an attached element in the host document. Its idempotent release function removes listeners and restores styles; reader destruction also releases it. Use a caller-owned panel or gesture handle with appropriate accessible controls. Host panels also respect selections in visible chapter documents.

The tested WebKit engine suppresses DOM event callbacks inside script-disabled sandboxed iframes, including callbacks installed by the host. Consequently direct chapter swipes and automatic iframe `scrollend` snapping cannot run there under the passive policy. Host touch panels and explicit `snap()` work across Chromium, Firefox, and WebKit without changing isolation. Cross-engine tests cover host panels; Chromium additionally exercises real mobile contacts inside passive chapter frames.

`reader.touch.whenIdle()` resolves or rejects the accepted asynchronous gesture. `reader.touch.lastError` retains a failure until a new accepted gesture starts. Calls issued through reader methods retain their usual independent promises. Gesture support owns no UI, toolbar, or persistence.
