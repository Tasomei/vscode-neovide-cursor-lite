# VS Code Neovide Cursor Lite

English | [简体中文](./README.zh-CN.md)

Neovide-style cursor animation for VS Code. One JavaScript file, no runtime dependencies.

[Download](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js)
· [SHA-256](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/SHA256SUMS.txt)
· [Releases](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)

## Features

- Four-corner spring animation with theme-aware colour.
- Six cursor styles, multiple cursors and Vim-style shape changes.
- Transitions between split editors, Diff editors and the Extensions search box.
- Reduced-motion support, idle rendering suspension and native-caret fallback on errors.

## Installation

1. Install [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css).
2. Download `cursor-trail.js` to a permanent local directory.
3. Open `Preferences: Open User Settings (JSON)` and add the file URI, preserving existing imports:

   ```json
   {
     "vscode_custom_css.imports": ["file:///C:/path/to/cursor-trail.js"]
   }
   ```

   Replace the path. macOS example: `file:///Users/your-name/path/cursor-trail.js`.

4. Run `Enable Custom CSS and JS` from the Command Palette, then restart VS Code.

The loader requires write access to the VS Code installation; Windows may require administrator privileges.

Verify the download against `SHA256SUMS.txt`:

```powershell
Get-FileHash -Algorithm SHA256 "C:\path\to\cursor-trail.js"
```

## Configuration

Supported styles: `line`, `line-thin`, `block`, `block-outline`, `underline`, `underline-thin`.

Edit `CONFIG` in [cursor-trail.js](./cursor-trail.js), then reload the script. Common options:

| Option | Default | Description |
| --- | ---: | --- |
| `opacity` | `0.88` | Cursor opacity |
| `holdMs` | `170` | Fade-out delay (ms) |
| `fadeMs` | `180` | Fade-out duration (ms) |
| `animationLength` | `0.16` | Long-movement spring time (s) |
| `shortAnimationLength` | `0.065` | Short-movement spring time (s) |
| `maxDrawWidth` | `4` | Regular line width cap before deformation (px) |
| `maxDevicePixelRatio` | `2` | Canvas pixel-ratio limit |
| `idleGraceMs` | `250` | Minimum active time after input (ms) |
| `respectReducedMotion` | `true` | Honour the system reduced-motion preference |
| `pauseWhenWindowBlurred` | `true` | Pause when unfocused |
| `useShadow` | `false` | Cursor glow |
| `zIndex` | `100` | Overlay stacking level |
| `fallbackColor` | `#ca9ee6` | Fallback cursor colour |

Spring times are base parameters, not fixed durations. Idle rendering stops; scanning defaults to
100 ms intervals. Hidden windows suspend both; unfocused windows do so by default.

## Usage

- **Update:** after script, configuration or VS Code changes, run `Reload Custom CSS and JS` and restart.
- **Uninstall:** remove the script URI from `vscode_custom_css.imports`, then reload and restart.

<details>
<summary>Controls and diagnostics</summary>

Open `Developer: Toggle Developer Tools` → **Console**.

Disable:

```javascript
window.__vscodeNeovideCursorLite.setEnabled(false)
```

Enable:

```javascript
window.__vscodeNeovideCursorLite.setEnabled(true)
```

The switch applies to this window and resets to enabled on script reload. Enabling preserves configured pause policies;
failed instances require reloading.

Read status:

```javascript
window.__vscodeNeovideCursorLite?.getStatus?.() ?? { state: "diagnostics-unavailable" }
```

| State | Meaning |
| --- | --- |
| `starting` | Waiting for the document |
| `active` / `idle` | Render loop active / suspended |
| `disabled` | Manually disabled |
| `paused` | `pauseReasons`: `hidden`, `blur`, `reduced-motion` |
| `no-cursor` | No tracked Monaco carets |
| `unavailable` | Canvas unavailable |
| `failed` | `failure`: `initialization-error`, `runtime-error`, `cleanup-error` |
| `disposed` | Removed instance; retained references only |
| `diagnostics-unavailable` | Script absent or diagnostics unsupported |

Diagnostics return cached state only, without scanning or waking rendering. `enabled` is the switch state;
`schemaVersion` is the diagnostic format version. Developer Tools may cause a `blur` pause.

</details>

## Compatibility

| Environment | Status |
| --- | --- |
| VS Code desktop on Windows 11 and macOS | Manually verified |
| Linux, VS Code Insiders, VSCodium | Not verified |
| VS Code for the Web | Unsupported |

Uses unofficial workbench injection, which may trigger integrity warnings or break after VS Code updates.
Ordinary HTML inputs and password fields are not animated.

## Privacy

Reads only caret geometry, styles and interface activity. No input-text, cookie or clipboard access,
network requests, persistent storage or system commands. Diagnostics exclude input data and raw exceptions.
Private reporting: [SECURITY.md](./SECURITY.md).

## Troubleshooting

- **No animation:** check the script URI, loader and diagnostic status.
- **Failed:** reload the script and restart VS Code.
- **Trail above menus:** lower `CONFIG.zIndex`.

## Development

Requires Node.js for tests and packaging only.

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

```powershell
node scripts/prepare-release.js
```

[Contributing](./CONTRIBUTING.md) · [Publishing](./docs/PUBLISHING.md)

## License

[MIT](./LICENSE). Inspired by [Neovide](https://github.com/neovide/neovide) and
[30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor). See [NOTICE.md](./NOTICE.md).
