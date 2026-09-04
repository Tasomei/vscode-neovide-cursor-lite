# VS Code Neovide Cursor Lite

一个给 VS Code 用的轻量级 Neovide 风格光标动画脚本。

它不是普通的“残影贴纸”，而是用一层透明 `canvas` 画出一个会被拉伸、回弹、追随真实光标的假光标。移动时会有一点橡皮筋一样的拖拽感，停下后尾巴会短暂停留再淡出。总之，光标终于不像在格子里瞬移了。

<details>
<summary><b>English</b></summary>

A single-file Neovide-like cursor animation for VS Code, loaded through the Custom CSS and JS
Loader extension (`be5invis.vscode-custom-css`). It paints a fake caret on a transparent canvas
overlay; four corner points chase the real caret with damped springs, so the caret stretches while
moving and settles once you stop.

**Install** — install the extension, download this repository, point `vscode_custom_css.imports` at
the absolute `file:///` path of `cursor-trail.js`, run `Enable Custom CSS and JS`, then restart
VS Code.

**Configure** — every knob lives in the `CONFIG` block at the top of `cursor-trail.js`.

**Privacy** — the script makes no network requests and touches no files. It does listen for
`keydown` / `mousedown` / `scroll` / `resize`, purely to wake the render loop that is suspended
while the caret is idle; the handler never reads the event payload.

The detailed guide below is in Chinese. `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` and
`NOTICE.md` are in English.

</details>

## 功能

- 光标移动时被拉成长方形/四边形；
- 领先的一边更快，拖尾的一边更慢；
- 拖尾颜色自动跟随 VS Code 当前光标颜色；
- 停止移动后不会立刻消失，会稍微停一下再淡出；
- 整体偏轻快，不追求“糊成一条彩带”。

## 可实现的效果

- 左右移动光标，展示横向拖尾；
- 上下换行，展示纵向跟随；
- 快速移动或跳转，展示四角弹簧拉伸；
- 停止移动，展示尾巴短暂停留后淡出；
- 修改 `editorCursor.foreground`，展示拖尾颜色跟随光标颜色。

## 这个项目适合谁

适合你，如果你：

- 喜欢 Neovide 那种灵动的光标动画；
- 想在 VS Code 里获得类似感觉；
- 不想安装一整套额外构建工具；
- 能接受用 Custom CSS and JS Loader 注入本地 JS；
- 愿意在 VS Code 更新后偶尔重新 reload 一下。

不太适合你，如果你：

- 完全不想修改 VS Code workbench；
- 需要官方支持级别的稳定性。

## 和参考项目相比有什么不同

这个项目受 [30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor) 启发。核心思路一致：`canvas` 覆盖层 + 四个角点 + 弹簧追随。

但这个仓库不是把原项目完整搬过来，而是做了一个更轻的自定义版本：

| 对比项 | Neovide-Cursor | 本项目 |
| --- | --- | --- |
| 使用方式 | VS Code 扩展 + 生成注入路径 | 单个 `cursor-trail.js` 文件 |
| 配置入口 | 扩展命令打开配置 | 直接改文件顶部 `CONFIG` |
| 颜色 | 可配置固定颜色 | 默认读取 VS Code 真实光标颜色 |
| 手感 | 更完整，也更重 | 默认更轻、更快、更克制 |
| 发光阴影 | 支持 | 支持，但默认关闭 |
| 启动保护 | 完整扩展流程 | 等待 DOM 就绪，重复注入时自动清理旧实例 |
| 安全透明度 | 扩展项目结构 | 单文件，比较容易自己审 |

坦诚一点说：参考项目功能更完整。

## 安全说明

当前脚本是本地单文件，不需要 npm，不会主动联网。

它不应该做这些事：

- 发网络请求；
- 读写你的文件；
- 执行系统命令；
- 读取 cookie、本地存储或剪贴板；
- 记录、保存或上传你敲了什么。

它主要做这些事：

- 找到 VS Code 编辑器里的真实光标 DOM；
- 读取光标位置、大小和颜色；
- 用 `canvas` 画动画；
- 动画时临时隐藏原生光标；
- 停止后恢复原生光标；
- 监听 `keydown`、`mousedown`、`scroll`、`resize` 事件。

最后一条需要说明白：光标静止时脚本会挂起渲染循环，避免空转耗电，这几个事件的作用就是把循环唤醒。回调只有一句 `requestFrame()`，不会读取事件对象里的任何字段，也就是说脚本知道"你按了键"，但不知道你按的是哪个键，更不会存下来或发出去。相关代码在 `CursorManager.start()` 和 `requestFrame()`，一共几行，可以自己核对。

不过还是要说清楚：Custom CSS and JS Loader 这个机制本身很强，别随便加载陌生人的远程脚本。推荐只使用本地路径，例如：

```json
"vscode_custom_css.imports": [
  "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
]
```

不要这样：

```json
"vscode_custom_css.imports": [
  "https://example.com/some-random-script.js"
]
```

## 安装教程

### 1. 安装 Custom CSS and JS Loader

在 VS Code 扩展面板里搜索并安装：

```txt
Custom CSS and JS Loader
```

扩展标识符：

```txt
be5invis.vscode-custom-css
```

### 2. 下载这个项目

推荐从 Releases 页下载带版本号的压缩包：

```txt
https://github.com/Tasomei/vscode-neovide-cursor-lite/releases
```

也可以在仓库首页点 `Code -> Download ZIP` 拿主分支的最新代码，但那是开发中的状态，不保证稳定。

下载后解压到一个固定位置。

Windows 例如：

```txt
C:\Users\your-name\vscode-neovide-cursor-lite
```

macOS 例如：

```txt
/Users/your-name/vscode-neovide-cursor-lite
```

这里的 `your-name` 换成你的系统用户名。也可以放到其他固定目录，重点是后面的 `settings.json` 路径要和真实位置一致。

### 3. 打开 VS Code 设置 JSON

Windows / Linux 按：

```txt
Ctrl + Shift + P
```

macOS 按：

```txt
Cmd + Shift + P
```

输入并打开：

```txt
Preferences: Open User Settings (JSON)
```

### 4. 加入脚本路径

在 `settings.json` 里加入：

Windows 示例：

```json
"vscode_custom_css.imports": [
  "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
]
```

macOS 示例：

```json
"vscode_custom_css.imports": [
  "file:///Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
]
```

注意 Windows 路径要写成这样：

```txt
file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js
```

不要写成这样：

```txt
C:\Users\your-name\vscode-neovide-cursor-lite\cursor-trail.js
```

macOS 路径也要写成完整的 `file:///Users/...`，不要写成 `~/...`。

如果你原本已经有很多设置，记得 JSON 逗号规则：

```json
{
  "editor.fontSize": 17,
  "vscode_custom_css.imports": [
    "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
  ]
}
```

### 5. 给 VS Code 足够权限

Windows 上通常需要这样做：

1. 关闭所有 VS Code 窗口；
2. 右键 VS Code 图标；
3. 选择“以管理员身份运行”。

macOS 可以先直接执行下一步。只有在启用或重载时提示权限失败，才需要看 [macOS 权限失败](#macos-权限失败)。

### 6. 启用注入

在 VS Code 里打开命令面板：

```txt
Windows / Linux: Ctrl + Shift + P
macOS: Cmd + Shift + P
```

执行：

```txt
Enable Custom CSS and JS
```

然后再执行：

```txt
Reload Custom CSS and JS
```

最后完整重启 VS Code。

## 推荐 VS Code 设置

这不是必须，但手感会更好：

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

脚本会读取 `editorCursor.foreground`，所以你改真实光标颜色，动画颜色也会一起变。

`editor.cursorWidth` 决定静止时的光标粗细。移动时的拖尾宽度由 `CONFIG.maxDrawWidth`（默认 4）决定，通常更细——细长的拖尾才有 smear 的感觉。

这里没有列 `editor.cursorSmoothCaretAnimation`。脚本会给光标加上 `transition: none !important` 来接管动画，那个设置在装了脚本之后基本不起作用，开不开都行。

如果你已经有 `workbench.colorCustomizations`，不要整段覆盖，只把 `editorCursor.foreground` 这一项合进去即可。

## 调参

打开 `cursor-trail.js`，看最上面的 `CONFIG`。

常用参数：

```js
opacity: 0.88,
holdMs: 170,
fadeMs: 180,
animationLength: 0.16,
shortAnimationLength: 0.065,
rankTrailFactors: [1.05, 0.82, 0.36, 0.08],
maxDevicePixelRatio: 2,
```

想更轻快：

```js
animationLength: 0.13,
shortAnimationLength: 0.045,
holdMs: 130,
fadeMs: 140,
```

想拖尾更明显：

```js
animationLength: 0.22,
shortAnimationLength: 0.1,
holdMs: 260,
fadeMs: 240,
```

想让尾巴更亮：

```js
opacity: 1,
```

想让它少一点厚重感：

```js
maxDrawWidth: 3,
```

`maxDrawWidth` 是拖尾的宽度上限，默认 `4`，通常比 `editor.cursorWidth` 小。移动时光标收窄成细长的一条，这是 smear 效果的一部分。调大它拖尾会跟随真实光标宽度，看起来更厚重。

`maxDevicePixelRatio` 是全屏画布的设备像素比上限，默认 `2`。常见的 1x、1.25x、1.5x、2x 屏幕不会受影响；更高 DPI 会按 2x 绘制，避免画布像素数和显存占用继续平方增长。如果更看重资源占用，可以设成 `1`，代价是高分屏上的边缘会稍微软一点。

每次改完脚本后，都要执行：

```txt
Reload Custom CSS and JS
```

然后 reload 或重启 VS Code。

## 常见问题

### 没有效果

按顺序检查：

- `Custom CSS and JS Loader` 是否安装；
- `settings.json` 里的路径是否真的指向 `cursor-trail.js`；
- 路径是否使用了 `file:///C:/Users/your-name/...` 或 `file:///Users/your-name/...` 格式；
- Windows 是否用管理员权限执行过 `Enable Custom CSS and JS`；
- macOS 是否因为 VS Code 安装目录权限导致 reload 失败；
- 是否执行过 `Reload Custom CSS and JS`；
- 是否完整重启 VS Code。

### macOS 权限失败

如果 macOS 上 `Enable Custom CSS and JS` 或 `Reload Custom CSS and JS` 因为权限失败，可以打开终端执行：

```bash
sudo chown -R "$(whoami)" "/Applications/Visual Studio Code.app/Contents/MacOS/Electron"
```

这条命令会把 VS Code 应用内 Electron 目录的所有权改到当前用户。它是让注入生效的常见做法，但确实动了系统应用的权限，确认自己理解之后再执行。VS Code 大版本更新后可能需要重新执行一次。

如果你用的是 VS Code Insiders，路径通常是：

```bash
sudo chown -R "$(whoami)" "/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Electron"
```

如果你的 VS Code 不在 `/Applications`，需要把路径改成自己的安装位置。

### VS Code 提示安装损坏

这是 Custom CSS and JS Loader 的常见副作用。它修改了 VS Code 的 workbench 文件，所以 VS Code 会说“我好像被动过”。

如果编辑器正常、动画也正常，可以选择：

```txt
Don't Show Again
```

VS Code 更新后，通常需要重新执行：

```txt
Reload Custom CSS and JS
```

### 更新 VS Code 后失效

重新走这两步：

```txt
Enable Custom CSS and JS
Reload Custom CSS and JS
```

然后重启 VS Code。

### 感觉有点卡

光标静止时脚本会挂起动画循环，只留下每 100ms 一次的轻量扫描（`scanIntervalMs`），开销基本可以忽略。如果是动画过程本身觉得重，试这组更轻的参数：

```js
useShadow: false,
holdMs: 120,
fadeMs: 120,
animationLength: 0.12,
```

不建议调大 `scanIntervalMs`。它除了发现新光标，还负责刷新光标颜色和兜底唤醒动画循环，调大会让这两件事变迟钝。

### 按键之后动画慢半拍

脚本在光标静止时会挂起渲染循环，靠键盘和鼠标事件唤醒。如果唤醒的时机早于 VS Code 更新光标位置，第一帧会扑空，动画就得等下一次扫描才启动。`idleGraceMs`（默认 250）是唤醒后强制保持运行的毫秒数，调大通常就能解决：

```js
idleGraceMs: 500,
```

想彻底关掉挂起机制、让渲染循环一直运行，把它设成一个极大值即可：

```js
idleGraceMs: 999999,
```

代价是编辑器静止时也会持续占用一点资源，好处是行为最可预测。

### 拖尾盖住了命令面板或右键菜单

调低 `zIndex`：

```js
zIndex: 50,
```

这个值需要压在编辑器文本之上、浮层之下，默认 `100`。

## 卸载

从 `settings.json` 里删掉你之前加入的 `vscode_custom_css.imports` 配置。

然后执行：

```txt
Reload Custom CSS and JS
```

重启 VS Code。

## 致谢

本项目参考了：

- [30d98f9b2/Neovide-Cursor](https://github.com/30d98f9b2/Neovide-Cursor)
- 原项目中标注的作者：LengineerC
- [Neovide](https://github.com/neovide/neovide)

实现上的取舍见前面的[和参考项目相比有什么不同](#和参考项目相比有什么不同)，完整归属声明见 [NOTICE.md](./NOTICE.md)。

## 项目文档

- [CHANGELOG.md](./CHANGELOG.md) — 版本变更记录
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 参与贡献
- [SECURITY.md](./SECURITY.md) — 安全策略与漏洞报告
- [NOTICE.md](./NOTICE.md) — 第三方参考与归属

## License

MIT. See [LICENSE](./LICENSE).
