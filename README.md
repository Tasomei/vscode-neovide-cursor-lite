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
3. Open `Preferences: Open User Settings (JSON)` and add its URI to `vscode_custom_css.imports`:

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///C:/path/to/cursor-trail.js"
     ]
   }
   ```

   Replace the example path; preserve existing imports. On macOS, use `file:///Users/your-name/path/cursor-trail.js`.

4. Run `Enable Custom CSS and JS` from the Command Palette, then restart VS Code.

The loader needs write access to the VS Code installation; Windows may require administrator privileges.
After script, configuration or VS Code updates, run `Reload Custom CSS and JS` and restart.

To verify a download on Windows, compare its SHA-256 with the linked checksum file:

```powershell
Get-FileHash -Algorithm SHA256 "C:\path\to\cursor-trail.js"
```

## Configuration

The animation follows the rendered cursor style and colour, including Vim mode changes.
Supported styles: `line`, `line-thin`, `block`, `block-outline`, `underline`, `underline-thin`.

Edit `CONFIG` in [cursor-trail.js](./cursor-trail.js) to adjust these common options, then reload as above:

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

Spring times are base parameters, not fixed animation durations.
Idle rendering stops; scanning continues every 100 ms by default. Hidden windows suspend both.

## Compatibility

| Environment | Status |
| --- | --- |
| VS Code desktop on Windows 11 and macOS | Manually verified |
| Linux, VS Code Insiders, VSCodium | Not verified |
| VS Code for the Web | Unsupported |

Requires unofficial workbench injection, which may trigger an installation-integrity warning.
VS Code updates can require reinjection or break compatibility. Ordinary HTML inputs and password fields are not animated.

## Privacy

Reads caret geometry, styles and interface activity only. No input-text, cookie or clipboard access,
network requests, persistent storage or system commands. Error messages contain no exception details.
See [SECURITY.md](./SECURITY.md) for private reporting.

## Troubleshooting

- **No animation:** check the local URI, loader activation, window focus and reduced-motion setting.
- **Stopped after an error or update:** reload the script and restart VS Code.
- **Trail above menus:** lower `CONFIG.zIndex`.

**Uninstall:** remove the script URI from `vscode_custom_css.imports`, reload and restart VS Code.

## Development

Node.js is needed only for testing and release packaging.

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
