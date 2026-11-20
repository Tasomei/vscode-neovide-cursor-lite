# VS Code Neovide Cursor Lite

English · [简体中文](./README.zh-CN.md)

Neovide-style cursor animation for VS Code. A single JavaScript file with no runtime dependencies. **v1.0.0 is the planned final release.**

[Download](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js) · [SHA-256](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/SHA256SUMS.txt) · [Changelog](./CHANGELOG.md)

- Four-corner spring animation that follows the editor theme, with six cursor shapes, multiple carets and Vim-style shape changes.
- Cursor transitions across split editors, diff editors and the Extensions search box.
- Respects reduced-motion preferences, suspends idle rendering and restores the native caret on errors.

## Installation

1. Install [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css).
2. Download `cursor-trail.js` to a permanent local directory. Compare its SHA-256 with the checksum linked above.
3. In `Preferences: Open User Settings (JSON)`, add the script URI to `vscode_custom_css.imports`, preserving existing entries.

   ```json
   {
     "vscode_custom_css.imports": ["file:///C:/path/to/cursor-trail.js"]
   }
   ```

   On macOS, use `file:///Users/your-name/path/cursor-trail.js`. On Linux, use `file:///home/your-name/path/cursor-trail.js`.

4. Run `Enable Custom CSS and JS` from the Command Palette and restart VS Code.

The loader needs write access to the VS Code installation. Workbench injection may trigger an integrity warning or break after a VS Code update.

## Configuration and troubleshooting

- Edit `CONFIG` near the top of [cursor-trail.js](./cursor-trail.js) to adjust timing, opacity or pause behaviour. After changing the script or updating VS Code, run `Reload Custom CSS and JS` and restart.
- If the animation does not appear, check the file URI and confirm the loader is enabled. In the console opened by `Developer: Toggle Developer Tools`, run `window.__vscodeNeovideCursorLite?.getStatus?.()` to inspect its state.
- To uninstall, remove the script URI, run `Reload Custom CSS and JS` and restart.

## Compatibility and privacy

- **Supported:** VS Code desktop on Windows, macOS, and Linux.
- **Unsupported:** VS Code for the Web, and ordinary HTML inputs or password fields.

The script reads caret geometry, styles, and interface activity. It has no telemetry or network requests and does not read typed text, cookies, or the clipboard.

[MIT license](./LICENSE) · [Credits](./NOTICE.md) · [Security](./SECURITY.md) · [Development](./CONTRIBUTING.md)
