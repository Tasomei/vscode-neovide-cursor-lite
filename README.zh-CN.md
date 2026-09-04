# VS Code Neovide Cursor Lite

[English](./README.md) | 简体中文

一款轻量、无运行时依赖的 Visual Studio Code Neovide 风格光标动画。项目仅包含一个运行时
JavaScript 文件，通过
[Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css)
从本地加载。

## 功能特性

- 基于弹簧模型的四角光标形变
- 自动继承当前 VS Code 主题的光标颜色
- 在常规和高刷新率显示器上保持平滑
- 空闲时暂停渲染循环，减少后台开销
- 脚本重新加载时自动清理旧实例
- 无运行时依赖、构建步骤、网络访问或持久化存储

## 使用要求

- Visual Studio Code
- Custom CSS and JS Loader（`be5invis.vscode-custom-css`）

本项目使用非官方的工作台注入机制。VS Code 更新后可能需要重新启用脚本。

## 安装

1. 安装 [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css)。
2. 下载[最新版本](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)，并解压到固定的本地目录。
3. 从命令面板打开 `Preferences: Open User Settings (JSON)`，添加本地
   `cursor-trail.js` 的 URI。

   Windows：

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
     ]
   }
   ```

   macOS：

   ```json
   {
     "vscode_custom_css.imports": [
       "file:///Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
     ]
   }
   ```

4. 从命令面板运行 `Enable Custom CSS and JS`，然后重启 VS Code。

修改脚本或更新 VS Code 后，请运行 `Reload Custom CSS and JS` 并重启编辑器。在 Windows
上，启用或重新加载注入时可能需要以管理员身份启动 VS Code。

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

所有运行时选项都位于 [`cursor-trail.js`](./cursor-trail.js) 顶部的 `CONFIG` 对象中。常用选项如下：

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
| `useShadow` | `false` | 是否启用可选的发光效果 |
| `zIndex` | `100` | 覆盖层的堆叠层级 |
| `fallbackColor` | `#ca9ee6` | 无法读取主题颜色时使用的备用颜色 |

修改配置后请运行 `Reload Custom CSS and JS`。

## 隐私与安全

`cursor-trail.js` 在 VS Code 工作台内本地运行。它会读取光标的位置、尺寸、可见性和颜色，
用于绘制动画。它不会发起网络请求，不会访问 Cookie、存储或剪贴板，不会执行系统命令，
也不会持久化输入数据。

脚本监听键盘、鼠标、滚动和窗口尺寸事件，仅用于唤醒已经暂停的渲染循环；它不会读取事件
载荷。请始终通过本地 `file:///` URI 加载脚本，并在注入任何第三方脚本前自行审查其内容。
漏洞报告方式见 [SECURITY.md](./SECURITY.md)。

## 故障排查

- **没有动画：**检查 `file:///` URI，运行 `Enable Custom CSS and JS`，然后重启 VS Code。
- **更新后失效：**依次运行 `Enable Custom CSS and JS` 和 `Reload Custom CSS and JS`，然后重启 VS Code。
- **VS Code 提示安装已被修改：**这是工作台注入机制的已知结果，并非本脚本报告的错误。
- **拖尾显示在菜单上方：**调低 `CONFIG.zIndex`。

## 卸载

从 `vscode_custom_css.imports` 中移除脚本 URI，运行 `Reload Custom CSS and JS`，然后重启
VS Code。

## 开发与验证

Node.js 仅用于本地验证：

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

## 致谢

本项目的实现受
[30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) 和
[Neovide](https://github.com/neovide/neovide) 启发。完整归属信息见 [NOTICE.md](./NOTICE.md)。

## 许可证

[MIT](./LICENSE)
