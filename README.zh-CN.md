# VS Code Neovide Cursor Lite

[English](./README.md) | 简体中文

适用于 VS Code 的 Neovide 风格光标动画。单个 JavaScript 文件，无运行时依赖。

[下载脚本](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/cursor-trail.js)
· [SHA-256](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases/latest/download/SHA256SUMS.txt)
· [版本记录](https://github.com/Tasomei/vscode-neovide-cursor-lite/releases)

## 功能

- 四角弹簧动画，自动继承光标颜色。
- 支持六种光标样式、多光标及 Vim 模式形状切换。
- 支持分屏、Diff 编辑器与扩展搜索框之间的过渡。
- 遵循减少动态效果设置；空闲停止绘制，异常时恢复原生光标。

## 安装

1. 安装 [Custom CSS and JS Loader](https://marketplace.visualstudio.com/items?itemName=be5invis.vscode-custom-css)。
2. 下载 `cursor-trail.js`，保存至固定的本地目录。
3. 打开 `Preferences: Open User Settings (JSON)`，添加文件 URI，保留已有导入项：

   ```json
   {
     "vscode_custom_css.imports": ["file:///C:/path/to/cursor-trail.js"]
   }
   ```

   替换示例路径。macOS 示例：`file:///Users/your-name/path/cursor-trail.js`。

4. 从命令面板运行 `Enable Custom CSS and JS`，然后重启 VS Code。

加载器需要 VS Code 安装目录的写入权限；Windows 可能需要管理员权限。

将下载文件的 SHA-256 与 `SHA256SUMS.txt` 对比：

```powershell
Get-FileHash -Algorithm SHA256 "C:\path\to\cursor-trail.js"
```

## 配置

支持样式：`line`、`line-thin`、`block`、`block-outline`、`underline`、`underline-thin`。

修改 [cursor-trail.js](./cursor-trail.js) 中的 `CONFIG` 后重新加载脚本。常用选项：

| 选项 | 默认值 | 说明 |
| --- | ---: | --- |
| `opacity` | `0.88` | 光标不透明度 |
| `holdMs` | `170` | 淡出延迟（毫秒） |
| `fadeMs` | `180` | 淡出时长（毫秒） |
| `animationLength` | `0.16` | 长距离移动的弹簧时长（秒） |
| `shortAnimationLength` | `0.065` | 短距离移动的弹簧时长（秒） |
| `maxDrawWidth` | `4` | 普通线状光标形变前的宽度上限（像素） |
| `maxDevicePixelRatio` | `2` | 画布像素比上限 |
| `idleGraceMs` | `250` | 输入后保持活跃的最短时间（毫秒） |
| `respectReducedMotion` | `true` | 遵循系统减少动态效果设置 |
| `pauseWhenWindowBlurred` | `true` | 窗口失焦时暂停 |
| `useShadow` | `false` | 光标发光效果 |
| `zIndex` | `100` | 覆盖层堆叠层级 |
| `fallbackColor` | `#ca9ee6` | 备用光标颜色 |

弹簧时长为基础参数，并非固定动画时长。空闲时停止绘制，默认每 100 毫秒扫描一次；
窗口隐藏时两者均暂停，默认在失焦时同样暂停。

## 使用

- **更新：**脚本、配置或 VS Code 变更后，运行 `Reload Custom CSS and JS` 并重启。
- **卸载：**移除 `vscode_custom_css.imports` 中的脚本 URI，重新加载并重启。

<details>
<summary>开关与诊断</summary>

打开 `Developer: Toggle Developer Tools` → **Console**。

关闭：

```javascript
window.__vscodeNeovideCursorLite.setEnabled(false)
```

开启：

```javascript
window.__vscodeNeovideCursorLite.setEnabled(true)
```

开关仅对当前窗口生效，重新加载脚本后恢复开启。开启后仍遵循已配置的暂停策略；故障实例需重新加载。

查询状态：

```javascript
window.__vscodeNeovideCursorLite?.getStatus?.() ?? { state: "diagnostics-unavailable" }
```

| 状态 | 含义 |
| --- | --- |
| `starting` | 等待页面就绪 |
| `active` / `idle` | 渲染循环活跃／空闲 |
| `disabled` | 手动关闭 |
| `paused` | `pauseReasons`：`hidden`（隐藏）、`blur`（失焦）、`reduced-motion`（减少动态效果） |
| `no-cursor` | 未跟踪到 Monaco 光标 |
| `unavailable` | Canvas 不可用 |
| `failed` | `failure`：`initialization-error`（初始化）、`runtime-error`（运行）、`cleanup-error`（清理） |
| `disposed` | 实例已移除，仅保留的引用可查询 |
| `diagnostics-unavailable` | 脚本未加载或不支持诊断 |

诊断仅返回缓存状态，不扫描、不唤醒渲染。`enabled` 为开关状态，`schemaVersion` 为诊断格式版本。
开发者工具可能导致 `blur` 暂停。

</details>

## 兼容性

| 环境 | 状态 |
| --- | --- |
| Windows 11、macOS 上的 VS Code 桌面版 | 已完成人工验证 |
| Linux、VS Code Insiders、VSCodium | 尚未验证 |
| VS Code 网页版 | 不支持 |

依赖非官方工作台注入，可能触发完整性警告或在 VS Code 更新后失效。
不为普通 HTML 输入框和密码框提供动画。

## 隐私

仅读取光标几何、样式及界面活动状态。不读取输入文字、Cookie 或剪贴板，
不联网、不持久化存储、不执行系统命令。诊断不含输入数据或原始异常。
私密报告：[SECURITY.md](./SECURITY.md)。

## 故障排查

- **没有动画：**检查脚本 URI、加载器及诊断状态。
- **运行异常：**重新加载脚本并重启 VS Code。
- **拖尾覆盖菜单：**调低 `CONFIG.zIndex`。

## 开发

Node.js 仅用于测试和发布打包。

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

```powershell
node scripts/prepare-release.js
```

[贡献指南](./CONTRIBUTING.md) · [发布指南](./docs/PUBLISHING.md)

## 许可证

[MIT](./LICENSE)。受 [Neovide](https://github.com/neovide/neovide) 与
[30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) 启发。归属信息见 [NOTICE.md](./NOTICE.md)。
