# Publishing Guide

本清单供仓库维护者发布正式版本时使用。示例版本为 `0.2.0`，所有命令均在仓库根目录的
PowerShell 7 中执行。

0.2.0 尚在开发验收阶段。先在 VS Code 中确认默认手感、光标形状、Vim 模式切换、分屏、
Diff、搜索框和暂停恢复行为，再执行提交标签及发布步骤。发布时更新 CHANGELOG 的日期和
比较链接，并移除两份 README 中的开发版本及待验收提示。

## 1. 核对发布内容

确认工作区只包含本次版本需要的修改：

```powershell
git status --short --branch
```

检查相对上一版本的完整差异：

```powershell
git diff v0.1.2 --
```

确认 `VERSION`、`CHANGELOG.md` 和准备发布的标签版本一致。

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

生成结果应位于 `dist/v0.2.0/`，并且只包含 `cursor-trail.js` 和 `SHA256SUMS.txt`。

复核发布文件的实际哈希：

```powershell
Get-FileHash -Algorithm SHA256 "dist\v0.2.0\cursor-trail.js"
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

发布前更新 `VERSION`、`CHANGELOG.md` 中的版本号和日期。明确暂存本次发布文件，不要使用
未经检查的 `git add .`。

```powershell
git add VERSION README.md README.zh-CN.md CHANGELOG.md cursor-trail.js tests/cursor-trail.test.js docs/PUBLISHING.md
```

```powershell
git diff --cached --check
```

```powershell
git diff --cached --stat
```

```powershell
git commit -m "Release v0.2.0"
```

创建指向发布提交的附注标签：

```powershell
git tag -a v0.2.0 -m "v0.2.0"
```

```powershell
git show --no-patch --decorate v0.2.0
```

## 4. 推送

一次推送主分支和附注标签：

```powershell
git push origin main --follow-tags
```

如果远程分支已经变化，Git 会拒绝非快进推送。不要使用强制推送；先检查远程新增内容。

## 5. 创建 GitHub Release

先创建草稿并核对以下内容：

- Tag：`v0.2.0`
- Title：`v0.2.0`
- Previous tag：`v0.1.2`
- Release notes：使用 `CHANGELOG.md` 中 `0.2.0` 的内容
- Assets：上传 `dist/v0.2.0/cursor-trail.js` 和 `dist/v0.2.0/SHA256SUMS.txt`
- Pre-release：不勾选

发布前确认两个资产名称保持不变，否则 README 中的稳定下载链接会失效。

发布后核对：

- Release 页面、`main` 分支和标签指向同一个提交；
- GitHub Actions 中的 CI 已通过；
- README 中的 `releases/latest/download/cursor-trail.js` 可以直接下载；
- 下载后的 SHA-256 与 `SHA256SUMS.txt` 一致。
