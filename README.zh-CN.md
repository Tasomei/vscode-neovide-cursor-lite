# VS Code Neovide Cursor Lite

[English](./README.md) · 简体中文

为 VS Code 提供 Neovide 风格的光标动画。单个 JavaScript 文件，无运行时依赖。**v0.5.2 是最终版。**

[下载脚本](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js) · [SHA-256](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/SHA256SUMS.txt) · [更新日志](./CHANGELOG.md)

- 四角弹簧动画，跟随编辑器主题颜色，支持六种光标样式、多光标和 Vim 模式切换。
- 支持分屏、差异编辑器与扩展搜索框之间的光标过渡。
- 遵循减少动态效果设置，空闲时停止绘制，异常时恢复原生光标。

## 安装

1. 安装 [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css)。
2. 将 `cursor-trail.js` 下载到固定的本地目录，并与上方的 SHA-256 校验值比对。
3. 打开 `Preferences: Open User Settings (JSON)`，将脚本 URI 加入 `vscode_custom_css.imports`，保留已有条目。

   ```json
   {
     "vscode_custom_css.imports": ["file:///C:/path/to/cursor-trail.js"]
   }
   ```

   macOS 路径示例为 `file:///Users/your-name/path/cursor-trail.js`，Linux 路径示例为 `file:///home/your-name/path/cursor-trail.js`。

4. 在命令面板运行 `Enable Custom CSS and JS`，重启 VS Code。

加载器需要 VS Code 安装目录的写入权限。工作台注入可能触发完整性警告，也可能在 VS Code 更新后失效。

## 配置与排查

- 修改 [cursor-trail.js](./cursor-trail.js) 顶部的 `CONFIG` 可调整动画时长、不透明度和暂停行为。修改脚本或更新 VS Code 后，运行 `Reload Custom CSS and JS` 并重启。
- 如果动画没有出现，检查文件 URI 和加载器状态。用 `Developer: Toggle Developer Tools` 打开控制台，运行 `window.__vscodeNeovideCursorLite?.getStatus?.()` 查看状态。
- 卸载时移除脚本 URI，运行 `Reload Custom CSS and JS` 并重启。

## 兼容性与隐私

| 环境 | 状态 |
| --- | --- |
| Windows 11、macOS 上的 VS Code 桌面版 | 已人工验证 |
| Debian 13 上的 VS Code 桌面版 | 已在日常使用中验证 |
| 其他 Linux 发行版、VS Code Insiders 和 VSCodium | 尚未验证 |
| VS Code 网页版 | 不支持 |

脚本仅读取光标几何、样式和界面活动，无遥测或网络请求，不读取输入文字、Cookie 或剪贴板。普通 HTML 输入框和密码框不显示动画。

[MIT 许可证](./LICENSE) · [致谢](./NOTICE.md) · [安全](./SECURITY.md) · [开发](./CONTRIBUTING.md)
