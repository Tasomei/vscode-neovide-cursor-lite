# VS Code Neovide Cursor Lite

[English](./README.md) | 简体中文

一款性能优先、实现透明的 Visual Studio Code Neovide 风格光标动画。

- 基于弹簧模型的四角形变，并自动继承主题光标颜色
- 仅包含一个运行时 JavaScript 文件
- 无运行时依赖和构建步骤
- 无网络请求、遥测或持久化存储
- 空闲时暂停动画循环

[下载 `cursor-trail.js`](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js)
· [查看全部版本](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)

## 安装

1. 安装 [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css)。
2. 下载最新版 Release 中的 `cursor-trail.js`，并保存到固定的本地目录。
3. 打开 `Preferences: Open User Settings (JSON)`，添加它的本地 URI：

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
     ]
   }
   ```

   macOS 路径示例：`file:///Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js`。

4. 从命令面板运行 `Enable Custom CSS and JS`，然后重启 VS Code。

修改脚本或更新 VS Code 后，请运行 `Reload Custom CSS and JS` 并重启编辑器。在 Windows
上，启用或重新加载注入时可能需要以管理员身份启动 VS Code。

从 v0.1.2 开始，Release 会直接提供运行时文件。需要验证完整性时，请将下载文件的哈希值与
`SHA256SUMS.txt` 对比：

```powershell
Get-FileHash -Algorithm SHA256 "C:\path\to\cursor-trail.js"
```

## 推荐的 VS Code 设置

以下设置均为可选项：

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

如果已经配置了 `workbench.colorCustomizations`，请只合并
`editorCursor.foreground`，不要替换整个对象。

## 配置

运行时选项位于 [`cursor-trail.js`](./cursor-trail.js) 顶部的 `CONFIG` 对象中。

| 选项 | 默认值 | 作用 |
| --- | ---: | --- |
| `opacity` | `0.88` | 动画光标的不透明度 |
| `holdMs` | `170` | 开始淡出前的停留时间 |
| `fadeMs` | `180` | 淡出持续时间 |
| `animationLength` | `0.16` | 较长距离移动时的弹簧时长 |
| `shortAnimationLength` | `0.065` | 短距离移动时的弹簧时长 |
| `maxDrawWidth` | `4` | 动画光标的最大宽度 |
| `maxDevicePixelRatio` | `2` | 画布设备像素比上限 |
| `idleGraceMs` | `250` | 输入后保持渲染循环活跃的最短时间 |
| `useShadow` | `false` | 可选的发光效果 |
| `zIndex` | `100` | 覆盖层的堆叠层级 |
| `fallbackColor` | `#ca9ee6` | 无法读取主题颜色时使用的备用颜色 |

修改配置后请运行 `Reload Custom CSS and JS`。

## 兼容性

| 环境 | 状态 |
| --- | --- |
| Windows 11 上的 VS Code 桌面版 | 主要开发和实际使用环境 |
| macOS 或 Linux 上的 VS Code 桌面版 | 按实现应可工作，仍需要人工验证 |
| VS Code Insiders 或 VSCodium | 尚未正式验证 |
| VS Code 网页版 | 不支持，因为无法进行本地工作台注入 |

本项目使用非官方工作台注入机制。VS Code 更新后可能需要重新启用脚本，内部 DOM 变化也
可能影响动画。

## 隐私

脚本只读取光标的位置、尺寸、可见性和颜色来绘制动画。它不会发起网络请求，不会访问
Cookie、存储或剪贴板，不会执行系统命令，也不会持久化输入数据。键盘、鼠标、滚动和窗口
尺寸监听器只用于唤醒暂停的渲染循环，不会检查事件载荷。

请通过本地 `file:///` URI 加载脚本，并在注入第三方脚本前检查其内容。私密报告方式见
[SECURITY.md](./SECURITY.md)。

## 故障排查

- **没有动画：**检查 `file:///` URI，运行 `Enable Custom CSS and JS`，然后重启 VS Code。
- **更新后失效：**运行 `Enable Custom CSS and JS`，再运行 `Reload Custom CSS and JS`，然后重启 VS Code。
- **VS Code 提示安装已被修改：**这是工作台注入机制的已知结果。
- **拖尾显示在菜单上方：**调低 `CONFIG.zIndex`。

## 卸载

从 `vscode_custom_css.imports` 中移除脚本 URI，运行 `Reload Custom CSS and JS`，然后重启
VS Code。

## 开发与验证

Node.js 仅用于本地验证和打包 Release 资产：

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

## 致谢

本项目受 [30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) 和
[Neovide](https://github.com/neovide/neovide) 启发。完整归属信息见 [NOTICE.md](./NOTICE.md)。

## 许可证

[MIT](./LICENSE)
