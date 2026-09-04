# Changelog

## Unreleased

- Preserve each Monaco caret's existing inline styles by hiding it with a scoped CSS class.
- Wake the suspended render loop for caret size-only changes as well as position changes.
- Cap the canvas device pixel ratio at a configurable value to bound high-DPI resource use.
- Fall back cleanly to the native caret when a 2D canvas context is unavailable.
- Add dependency-free lifecycle, cleanup, configuration and privacy regression tests, plus CI.

## 0.1.0

- Neovide-like caret animation drawn on a transparent canvas overlay.
- Spring-based four-corner deformation; the corner leading the movement catches up faster than the
  trailing ones.
- Caret colour follows the VS Code theme (`editorCursor.foreground`), with a configurable fallback.
- The trail holds briefly after the caret stops moving, then fades out.
- The render loop suspends while the caret is idle and wakes on key, mouse, scroll and resize
  events; only a lightweight 100ms scan keeps running.
- Every `getComputedStyle` read happens in the periodic scan rather than once per frame.
- Spring integration is sub-stepped, so the animation behaves the same on 60Hz displays and on
  high-refresh-rate ones.
- Injecting the script again disposes the previous instance, including before `document.body`
  exists.
- Single file, no build step, no npm dependency; every knob lives in the `CONFIG` block at the top
  of `cursor-trail.js`.
