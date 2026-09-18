# VS Code Neovide Cursor Lite

English | [简体中文](./README.zh-CN.md)

A lightweight, dependency-free Neovide-style cursor animation for Visual Studio Code.

[Download `cursor-trail.js`](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js)
· [Checksums](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/SHA256SUMS.txt)
· [Releases](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)

## Features

- Spring-based four-corner animation with a bounded elastic trail
- Native support for all six VS Code cursor styles
- Smooth transitions between standard, split and Diff editors
- Multiple-cursor and Vim-style shape-change handling
- Theme-aware colour, reduced-motion support and idle suspension
- Single auditable JavaScript file with no runtime dependencies, telemetry or persistent storage

## Installation

1. Install [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css).
2. Download `cursor-trail.js` and save it in a permanent local directory.
3. Open `Preferences: Open User Settings (JSON)` and add the file URI:

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
     ]
   }
   ```

   On macOS, use a URI such as
   `file:///Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js`.

4. Run `Enable Custom CSS and JS` from the Command Palette, then restart VS Code.

After updating the script or VS Code, run `Reload Custom CSS and JS` and restart the editor.
Windows may require administrator privileges while enabling or reloading the injection.

To verify the download, compare the following output with `SHA256SUMS.txt`:

```powershell
Get-FileHash -Algorithm SHA256 "C:\path\to\cursor-trail.js"
```

### Optional VS Code settings

```json
{
  "editor.cursorStyle": "line",
  "editor.cursorWidth": 6,
  "editor.cursorBlinking": "phase",
  "workbench.colorCustomizations": {
    "editorCursor.foreground": "#babbf1"
  }
}
```

Merge `editorCursor.foreground` into an existing `workbench.colorCustomizations` object.

## Configuration

Edit the `CONFIG` object at the top of [`cursor-trail.js`](./cursor-trail.js), then run
`Reload Custom CSS and JS`.

| Option | Default | Description |
| --- | ---: | --- |
| `opacity` | `0.88` | Animated cursor opacity |
| `holdMs` | `170` | Delay before fade-out (ms) |
| `fadeMs` | `180` | Fade-out duration (ms) |
| `animationLength` | `0.16` | Base spring time for longer movements (s) |
| `shortAnimationLength` | `0.065` | Base spring time for short movements (s) |
| `maxDrawWidth` | `4` | Maximum regular line-cursor width before deformation (px) |
| `maxDevicePixelRatio` | `2` | Canvas pixel-ratio limit |
| `idleGraceMs` | `250` | Minimum active time after input (ms) |
| `respectReducedMotion` | `true` | Use the native caret when reduced motion is requested |
| `pauseWhenWindowBlurred` | `true` | Pause while the window is unfocused |
| `useShadow` | `false` | Enable an optional glow |
| `zIndex` | `100` | Overlay stacking level |
| `fallbackColor` | `#ca9ee6` | Colour used when the theme value is unavailable |

Supported styles are `line`, `line-thin`, `block`, `block-outline`, `underline` and
`underline-thin`. Shapes are read from Monaco's rendered caret, so changes made by Vim extensions
do not require separate configuration.

Transitions also cover the Monaco-based Extensions search box, using its rendered caret geometry
without reading search text. Ordinary HTML inputs and password fields are not supported.

Rendering and scanning stop while the window is hidden. On resume, the animation starts at the
current caret position without replaying background movement.

## Compatibility

| Environment | Status |
| --- | --- |
| VS Code desktop on Windows 11 | Tested and supported |
| VS Code desktop on macOS | Manually verified |
| VS Code desktop on Linux | Expected to work; not manually verified |
| VS Code Insiders or VSCodium | Not officially verified |
| VS Code for the Web | Not supported |

The project relies on unofficial workbench injection. VS Code updates may require the script to be
enabled again or may change the internal DOM used by the animation.

## Privacy

The runtime reads caret geometry, styles and interface activity state. It does not read typed text,
make network requests, access cookies, storage or the clipboard, execute system commands, or persist
data. See [SECURITY.md](./SECURITY.md) for reporting instructions.

## Troubleshooting

- **No animation:** verify the `file:///` URI, run `Enable Custom CSS and JS`, and restart VS Code.
- **Paused animation:** check the system reduced-motion setting and window focus.
- **Stopped after a runtime error:** the script disables its overlay and restores the native caret.
  Run `Reload Custom CSS and JS` and restart VS Code to retry.
- **Stopped after an update:** run `Reload Custom CSS and JS`, then restart VS Code.
- **Modified installation warning:** this is an expected consequence of workbench injection.
- **Trail above menus:** reduce `CONFIG.zIndex`.

## Uninstallation

Remove the script URI from `vscode_custom_css.imports`, run `Reload Custom CSS and JS`, and restart
VS Code.

## Development

Node.js is required only for local verification and release packaging.

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

```powershell
node scripts/prepare-release.js
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the maintainer
[publishing guide](./docs/PUBLISHING.md).

## License

Released under the [MIT License](./LICENSE). Inspired by
[30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) and
[Neovide](https://github.com/neovide/neovide); see [NOTICE.md](./NOTICE.md).
