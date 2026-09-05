# VS Code Neovide Cursor Lite

English | [简体中文](./README.zh-CN.md)

A performance-first, auditable Neovide-style cursor animation for Visual Studio Code.

- Spring-based four-corner motion with theme-aware colour
- Single JavaScript file
- No runtime dependencies or build step
- No network requests, telemetry or persistent storage
- Suspends its animation loop while idle

[Download `cursor-trail.js`](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js)
· [All releases](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)

## Installation

1. Install [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css).
2. Download the latest `cursor-trail.js` release asset and save it in a permanent local directory.
3. Open `Preferences: Open User Settings (JSON)` and add its local URI:

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

After changing the script or updating VS Code, run `Reload Custom CSS and JS` and restart the
editor. Windows may require VS Code to be started as an administrator while enabling or reloading
the injection.

Release assets are published from v0.1.2 onward. Compare the downloaded file with
`SHA256SUMS.txt` when integrity verification is required:

```powershell
Get-FileHash -Algorithm SHA256 "C:\path\to\cursor-trail.js"
```

## Recommended VS Code Settings

These settings are optional:

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

Merge `editorCursor.foreground` into an existing `workbench.colorCustomizations` object instead of
replacing that object.

## Configuration

Runtime options are defined in the `CONFIG` object at the top of
[`cursor-trail.js`](./cursor-trail.js).

| Option | Default | Purpose |
| --- | ---: | --- |
| `opacity` | `0.88` | Animated cursor opacity |
| `holdMs` | `170` | Delay before fade-out begins |
| `fadeMs` | `180` | Fade-out duration |
| `animationLength` | `0.16` | Spring duration for longer movements |
| `shortAnimationLength` | `0.065` | Spring duration for short movements |
| `maxDrawWidth` | `4` | Maximum regular line-cursor trail width |
| `maxDevicePixelRatio` | `2` | Canvas pixel-ratio cap |
| `idleGraceMs` | `250` | Minimum active time after input |
| `respectReducedMotion` | `true` | Use the native caret when the system requests reduced motion |
| `pauseWhenWindowBlurred` | `true` | Suspend rendering and scanning while the window is unfocused |
| `useShadow` | `false` | Optional glow effect |
| `zIndex` | `100` | Overlay stacking level |
| `fallbackColor` | `#ca9ee6` | Colour used when the theme colour is unavailable |

Run `Reload Custom CSS and JS` after editing the configuration.

The animation follows `editor.cursorStyle`: `line`, `line-thin`, `block`, `block-outline`,
`underline` and `underline-thin`. Regular line cursors retain the existing narrow trail;
other styles use their native geometry. Shape changes are detected from Monaco's rendered caret,
including changes requested by Vim extensions; no separate Vim settings are required.

Hidden windows always suspend rendering and scanning. Reduced-motion or focus changes take effect
without reloading. Resuming starts at the current caret position without replaying background moves.
Moving focus between split or Diff editors animates from the previously focused caret while retaining
its geometry and a bounded elastic trail. Newly created secondary carets still begin at their own position
and do not produce unrelated cross-editor trails.

## Compatibility

| Environment | Status |
| --- | --- |
| VS Code desktop on Windows 11 | Primary development and use environment |
| VS Code desktop on macOS or Linux | Expected to work; manual verification is still needed |
| VS Code Insiders or VSCodium | Not officially verified |
| VS Code for the Web | Not supported because local workbench injection is required |

The project uses an unofficial workbench-injection mechanism. A VS Code update can require the
script to be enabled again and may change internal DOM details used by the animation.

0.2.0 has automated geometry and lifecycle regression coverage and has been manually accepted in
VS Code on Windows 11. Compatibility with every extension configuration remains unverified.

## Privacy

The script reads caret geometry, visibility and colour only to render the animation. It does not
make network requests, access cookies or storage, read the clipboard, execute system commands or
persist input data. Keyboard, mouse, scroll and resize listeners wake the render loop. Window focus,
page visibility and the system reduced-motion preference control suspension. Typed text is not read.

Load the script from a local `file:///` URI and review third-party scripts before injecting them.
See [SECURITY.md](./SECURITY.md) for private reporting instructions.

## Troubleshooting

- **No animation:** verify the `file:///` URI, run `Enable Custom CSS and JS`, and restart VS Code.
- **Animation is paused:** check the system reduced-motion preference and window focus. Set
  `respectReducedMotion` to `false` only if you want to override that preference.
- **Stopped working after an update:** run `Enable Custom CSS and JS`, then
  `Reload Custom CSS and JS`, and restart VS Code.
- **VS Code reports a modified installation:** this is a known consequence of workbench injection.
- **The trail appears above menus:** reduce `CONFIG.zIndex`.

## Uninstallation

Remove the script URI from `vscode_custom_css.imports`, run `Reload Custom CSS and JS`, and restart
VS Code.

## Development

Node.js is required only for local verification and release packaging:

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

## Acknowledgements

Inspired by [30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) and
[Neovide](https://github.com/neovide/neovide). See [NOTICE.md](./NOTICE.md) for attribution details.

## License

[MIT](./LICENSE)
