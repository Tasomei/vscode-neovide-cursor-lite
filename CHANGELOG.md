# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.4.0] - 2026-09-18

### Added

- Regression tests for runtime failures, partial initialization, cleanup errors and recovery after reinjection.
- A single fixed diagnostic message on failure, without logging exception details or input data.

### Fixed

- Restore the native caret and stop animation resources after runtime or partial initialization failures.

### Changed

- Mark macOS desktop as manually verified and retain the unverified status for Linux.

## [0.3.0] - 2026-09-16

### Added

- Regression coverage for invalid versions, incomplete release entries and unexpected assets.
- Regression coverage for interrupted split transitions at 60, 120 and 144 Hz, scrolling and delayed shape changes.
- Bidirectional transitions between the Extensions search editor and code editors without reading search text.

### Fixed

- Use the same four-corner spring motion for same-editor and cross-editor jumps instead of translating a short trail.
- Cancel stale cross-editor trails when focus changes during a transition and continue from the current transition position.
- Synchronize cross-editor transitions immediately when scrolling.
- Refresh caret discovery and visibility on the frame after a focus change instead of waiting for the periodic scan.
- Converge to the destination caret size during transitions and preserve spring motion on colour-only updates.
- Give unchanged destination geometry one render frame to update after a cross-editor mouse click, avoiding a jump through the stale row.

### Changed

- Validate semantic versions and dated CHANGELOG entries before writing release assets.
- Derive publishing-guide versions, tags and asset paths from repository state.
- Translate source comments into concise Chinese and clarify configuration units and supported input controls in both READMEs.

## [0.2.0] - 2026-09-05

### Added

- Automatic native line, thin line, block, outline and underline cursor geometry.
- Reduced-motion preference support with live updates and a native-caret fallback.
- Rendering and scan suspension while the window is unfocused or hidden.
- Focus transitions between split and Diff editors with native geometry and bounded elastic trails.
- Regression coverage for shape changes, multiple carets, editor transitions and suspension.

### Fixed

- Start unrelated newly visible or reparented carets at their own position instead of another editor's caret.
- Refresh stationary caret colours after style changes and preserve opaque RGB colours ending in zero.

Regular line-cursor spring parameters and the default narrow trail are unchanged.

### Removed

- The unused repository social-preview image.

## [0.1.2] - 2026-09-04

### Added

- A repository social-preview image.
- Direct release-asset packaging for `cursor-trail.js` with a SHA-256 checksum.
- Automated verification that release assets match the reviewed runtime source.
- Structured bug-report and feature-request forms.

### Changed

- Make direct release-asset download the primary installation path in both READMEs.
- Document verified, expected and unsupported environments without overstating compatibility.
- Build release assets as part of continuous integration.

The runtime animation and its default feel are unchanged in this release.

## [0.1.1] - 2026-09-04

### Added

- Dependency-free regression tests for lifecycle cleanup, high-DPI rendering, configuration usage
  and privacy-sensitive runtime APIs.
- GitHub Actions verification for JavaScript syntax and regression tests.
- A concise Simplified Chinese README alongside the primary English documentation.

### Changed

- Preserve each Monaco caret's existing inline styles by hiding it with a scoped CSS class.
- Wake the suspended render loop when only the caret dimensions change.
- Cap the canvas device pixel ratio through the configurable `maxDevicePixelRatio` option.
- Rewrite the primary README and source comments in professional English.

### Fixed

- Keep the native caret available when a 2D canvas context cannot be created.

## [0.1.0] - 2026-08-13

- Neovide-like caret animation drawn on a transparent canvas overlay.
- Spring-based four-corner deformation with direction-aware trailing behaviour.
- Caret colour inherited from the VS Code theme, with a configurable fallback.
- Idle render-loop suspension with keyboard, mouse, scroll and resize wake-ups.
- Frame-rate-independent spring integration for standard and high-refresh-rate displays.
- Automatic cleanup when the script is injected again.
- Single-file distribution with no build step or runtime dependency.

[Unreleased]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/tag/v0.1.0
