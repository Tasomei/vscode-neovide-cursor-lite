# Publishing Guide

本清单供仓库维护者发布正式版本时使用。所有命令均在仓库根目录的同一个 PowerShell 7
会话中执行。

发布前应在 VS Code 中确认默认手感、光标形状、Vim 模式切换、分屏、Diff、搜索框和暂停
恢复行为。`CHANGELOG.md` 的日期和比较链接、两份 README 的版本状态必须与发布候选一致。

## 1. 核对发布内容

普通开发期间让 `VERSION` 保持当前正式版本，并把新内容记录在 `[Unreleased]`。准备发布时，
先把 `VERSION` 更新为目标版本，再将对应 CHANGELOG 内容移入带正式日期的版本条目；完成这两项
后再执行下列命令。

从 `VERSION` 读取当前版本，并推导标签、上一版本标签和资产目录：

```powershell
$version = (Get-Content -LiteralPath "VERSION" -Raw).Trim()
```

```powershell
$tag = "v$version"
```

```powershell
$previousTag = git tag --merged HEAD --sort=-version:refname | Where-Object { $_ -ne $tag } | Select-Object -First 1
```

```powershell
if (-not $previousTag) { throw "No previous release tag found." }
```

```powershell
$assetDirectory = Join-Path "dist" $tag
```

```powershell
[PSCustomObject]@{ Version = $version; Tag = $tag; PreviousTag = $previousTag; Assets = $assetDirectory }
```

确认工作区只包含本次版本需要的修改：

```powershell
git status --short --branch
```

检查相对上一版本的完整差异：

```powershell
git diff "$previousTag" --
```

确认输出正确，并确认 `VERSION`、`CHANGELOG.md` 和准备发布的标签版本一致。以下两条命令
正常情况下均没有输出，表示本地和远程尚未存在当前标签：

```powershell
git tag --list "$tag"
```

```powershell
git ls-remote --tags origin "refs/tags/$tag"
```

确认提交身份使用 GitHub noreply 邮箱：

```powershell
git config --get user.name
```

```powershell
git config --get user.email
```

## 2. 运行发布检查

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

```powershell
node scripts/prepare-release.js
```

```powershell
git diff --check
```

打包脚本会拒绝无效 `VERSION`、缺失或重复的 CHANGELOG 版本条目，以及 `Unreleased` 或无效
日期。生成目录应与 `$assetDirectory` 一致，并且只包含 `cursor-trail.js` 和
`SHA256SUMS.txt`：

```powershell
Get-ChildItem -LiteralPath $assetDirectory
```

复核发布文件的实际哈希：

```powershell
Get-FileHash -Algorithm SHA256 (Join-Path $assetDirectory "cursor-trail.js")
```

检查凭据和私钥；正常情况下没有输出：

```powershell
git grep -n -I -E "github_pat_|gh[pousr]_|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY" -- . ':(exclude)docs/PUBLISHING.md'
```

检查真实本机路径；命中内容必须只是 `your-name` 这类文档占位符：

```powershell
git grep -n -I -E "C:\\Users\\[^\\]+|/Users/[^/]+" -- . ':(exclude)docs/PUBLISHING.md'
```

运行时代码不应包含网络、存储、剪贴板或动态执行入口：

```powershell
rg -n "fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|document\.cookie|localStorage|sessionStorage|navigator\.clipboard|eval\s*\(|new\s+Function|require\s*\(" cursor-trail.js
```

最后一条命令正常情况下没有输出。

## 3. 提交并创建本地标签

根据 `git status` 明确暂存本次实际修改的文件，不要使用未经检查的 `git add .`。以下列表
仅覆盖本项目常见发布文件，应按当前差异删减或补充：

```powershell
git add -- VERSION CHANGELOG.md README.md README.zh-CN.md cursor-trail.js docs/PUBLISHING.md scripts/prepare-release.js tests/cursor-trail.test.js tests/release-assets.test.js
```

```powershell
git diff --cached --check
```

```powershell
git diff --cached --stat
```

```powershell
git commit -m "Release $tag"
```

创建指向发布提交的附注标签：

```powershell
git tag -a "$tag" -m "$tag"
```

```powershell
git show --no-patch --decorate "$tag"
```

## 4. 推送

一次推送主分支和附注标签：

```powershell
git push origin main --follow-tags
```

如果远程分支已经变化，Git 会拒绝非快进推送。不要使用强制推送；先检查远程新增内容。

## 5. 创建 GitHub Release

先创建草稿并核对以下内容：

- Tag：`$tag`
- Title：`$tag`
- Previous tag：`$previousTag`
- Release notes：使用 `CHANGELOG.md` 中 `$version` 的内容
- Assets：上传 `$assetDirectory/cursor-trail.js` 和 `$assetDirectory/SHA256SUMS.txt`
- Pre-release：不勾选

发布前确认两个资产名称保持不变，否则 README 中的稳定下载链接会失效。

发布后核对：

- Release 页面、`main` 分支和标签指向同一个提交；
- GitHub Actions 中的 CI 已通过；
- README 中的 `releases/latest/download/cursor-trail.js` 可以直接下载；
- 下载后的 SHA-256 与 `SHA256SUMS.txt` 一致。
