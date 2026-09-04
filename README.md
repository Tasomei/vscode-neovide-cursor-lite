# VS Code Neovide Cursor Lite

English | [简体中文](./README.zh-CN.md)

A lightweight, dependency-free Neovide-style cursor animation for Visual Studio Code. The project
is distributed as a single JavaScript file and loaded locally through
[Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css).

## Features

- Spring-based, four-corner cursor deformation
- Cursor colour inherited from the active VS Code theme
- Smooth behaviour on standard and high-refresh-rate displays
- Idle render-loop suspension to reduce background work
- Automatic cleanup when the script is reloaded
- No runtime dependencies, build step, network access or persistent storage

## Requirements

- Visual Studio Code
- Custom CSS and JS Loader (`be5invis.vscode-custom-css`)

This project uses an unofficial workbench-injection mechanism. A VS Code update may require the
script to be enabled again.

## Installation

1. Install [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css).
2. Download the [latest release](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)
   and extract it to a permanent local directory.
3. Open `Preferences: Open User Settings (JSON)` from the Command Palette and add the local
   `cursor-trail.js` URI.

   Windows:

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
     ]
   }
   ```

   macOS:

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
     ]
   }
   ```

4. Run `Enable Custom CSS and JS` from the Command Palette, then restart VS Code.

After changing the script or updating VS Code, run `Reload Custom CSS and JS` and restart the
editor. Windows may require VS Code to be started as an administrator while enabling or reloading
the injection.

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
[`cursor-trail.js`](./cursor-trail.js). Common options include:

| Option | Default | Purpose |
| --- | ---: | --- |
| `opacity` | `0.88` | Animated cursor opacity |
| `holdMs` | `170` | Delay before fade-out begins |
| `fadeMs` | `180` | Fade-out duration |
| `animationLength` | `0.16` | Spring duration for longer movements |
| `shortAnimationLength` | `0.065` | Spring duration for short movements |
| `maxDrawWidth` | `4` | Maximum animated cursor width |
| `maxDevicePixelRatio` | `2` | Canvas pixel-ratio cap |
| `idleGraceMs` | `250` | Minimum active time after input |
| `useShadow` | `false` | Enables the optional glow effect |
| `zIndex` | `100` | Overlay stacking level |
| `fallbackColor` | `#ca9ee6` | Colour used when the theme colour is unavailable |

Run `Reload Custom CSS and JS` after editing the configuration.

## Privacy and Security

`cursor-trail.js` runs locally inside the VS Code workbench. It reads cursor geometry, visibility
and colour in order to draw the animation. It does not make network requests, access cookies or
storage, read the clipboard, execute system commands, or persist input data.

The script listens for keyboard, mouse, scroll and resize events only to wake its suspended render
loop; it does not inspect event payloads. Load the script from a local `file:///` URI and review any
third-party script before injecting it into VS Code. See [SECURITY.md](./SECURITY.md) for reporting
instructions.

## Troubleshooting

- **No animation:** verify the `file:///` URI, run `Enable Custom CSS and JS`, and restart VS Code.
- **Stopped working after an update:** run `Enable Custom CSS and JS`, then
  `Reload Custom CSS and JS`, and restart VS Code.
- **VS Code reports a modified installation:** this is a known consequence of workbench injection,
  not an error reported by this script.
- **The trail appears above menus:** reduce `CONFIG.zIndex`.

## Uninstallation

Remove the script URI from `vscode_custom_css.imports`, run `Reload Custom CSS and JS`, and restart
VS Code.

## Development

Node.js is required only for local verification:

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

## Acknowledgements

The implementation is inspired by
[30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) and
[Neovide](https://github.com/neovide/neovide). See [NOTICE.md](./NOTICE.md) for attribution details.

## License

[MIT](./LICENSE)
