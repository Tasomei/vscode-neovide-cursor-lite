# VS Code Neovide Cursor Lite

[English](./README.md) | 简体中文

一款轻量、无依赖的 Visual Studio Code Neovide 风格光标动画。

[下载 `cursor-trail.js`](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js)
· [校验和](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/SHA256SUMS.txt)
· [全部版本](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)

## 功能

- 基于弹簧模型的四角动画与受限长度弹性拖尾
- 原生支持 VS Code 的六种光标样式
- 支持普通、分屏和 Diff 编辑器之间的平滑过渡
- 正确处理多光标和 Vim 风格的形状切换
- 自动继承主题颜色，支持减少动态效果和空闲暂停
- 单个可审查的 JavaScript 文件，无运行时依赖、遥测或存储

## 安装

1. 安装 [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css)。
2. 下载 `cursor-trail.js`，并保存到固定的本地目录。
3. 打开 `Preferences: Open User Settings (JSON)`，添加文件 URI：

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
     ]
   }
   ```

   macOS 路径示例：`file:///Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js`。

4. 从命令面板运行 `Enable Custom CSS and JS`，然后重启 VS Code。

更新脚本或 VS Code 后，运行 `Reload Custom CSS and JS` 并重启编辑器。在 Windows 上，启用
或重新加载注入时可能需要管理员权限。

如需验证下载文件，请将以下命令的输出与 `SHA256SUMS.txt` 对比：

```powershell
Get-FileHash -Algorithm SHA256 "C:\path\to\cursor-trail.js"
```

### 可选 VS Code 设置

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

如果已经存在 `workbench.colorCustomizations`，只需合并 `editorCursor.foreground`。

## 配置

修改 [`cursor-trail.js`](./cursor-trail.js) 顶部的 `CONFIG` 对象，然后运行
`Reload Custom CSS and JS`。

| 选项 | 默认值 | 说明 |
| --- | ---: | --- |
| `opacity` | `0.88` | 动画光标不透明度 |
| `holdMs` | `170` | 开始淡出前的延迟 |
| `fadeMs` | `180` | 淡出持续时间 |
| `animationLength` | `0.16` | 较长距离移动的动画时长 |
| `shortAnimationLength` | `0.065` | 短距离移动的动画时长 |
| `maxDrawWidth` | `4` | 普通线状光标拖尾的最大宽度 |
| `maxDevicePixelRatio` | `2` | 画布设备像素比上限 |
| `idleGraceMs` | `250` | 输入后保持活跃的最短时间 |
| `respectReducedMotion` | `true` | 系统要求减少动态效果时使用原生光标 |
| `pauseWhenWindowBlurred` | `true` | 窗口失焦时暂停 |
| `useShadow` | `false` | 启用可选发光效果 |
| `zIndex` | `100` | 覆盖层堆叠层级 |
| `fallbackColor` | `#ca9ee6` | 无法读取主题颜色时使用的备用颜色 |

支持 `line`、`line-thin`、`block`、`block-outline`、`underline` 和 `underline-thin`。脚本直接
读取 Monaco 渲染的光标形状，因此 Vim 扩展触发的形状切换无需额外配置。

## 兼容性

| 环境 | 状态 |
| --- | --- |
| Windows 11 上的 VS Code 桌面版 | 已测试并支持 |
| macOS 或 Linux 上的 VS Code 桌面版 | 按实现应可工作，尚未人工验证 |
| VS Code Insiders 或 VSCodium | 尚未正式验证 |
| VS Code 网页版 | 不支持 |

本项目依赖非官方工作台注入。VS Code 更新后可能需要重新启用脚本，也可能因内部 DOM 变化而
影响动画。

## 隐私

运行时只读取已渲染光标的位置、尺寸、可见性和颜色。它不会读取输入文字，不会发起网络请求，
不会访问 Cookie、存储或剪贴板，不会执行系统命令，也不会持久化数据。问题报告方式见
[SECURITY.md](./SECURITY.md)。

## 故障排查

- **没有动画：**检查 `file:///` URI，运行 `Enable Custom CSS and JS`，然后重启 VS Code。
- **动画暂停：**检查系统的减少动态效果设置和窗口焦点。
- **更新后失效：**运行 `Reload Custom CSS and JS`，然后重启 VS Code。
- **提示安装已被修改：**这是工作台注入的正常结果。
- **拖尾显示在菜单上方：**调低 `CONFIG.zIndex`。

## 卸载

从 `vscode_custom_css.imports` 中移除脚本 URI，运行 `Reload Custom CSS and JS`，然后重启
VS Code。

## 开发

Node.js 仅用于本地验证和打包发布资产。

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

```powershell
node scripts/prepare-release.js
```

参与开发前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)，维护者发布流程见
[docs/PUBLISHING.md](./docs/PUBLISHING.md)。

## 许可证

本项目使用 [MIT 许可证](./LICENSE)。项目受
[30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) 和
[Neovide](https://github.com/neovide/neovide) 启发；归属信息见 [NOTICE.md](./NOTICE.md)。
