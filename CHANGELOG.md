# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

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

[Unreleased]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Tasomei/vscode-neovide-cursor-lite/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/tag/v0.1.0
