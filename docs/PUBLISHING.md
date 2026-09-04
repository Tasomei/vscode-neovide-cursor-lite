# Publishing Guide

本清单供仓库维护者发布正式版本时使用。示例版本为 `0.1.1`，所有命令均在仓库根目录的
PowerShell 7 中执行。

## 1. 核对发布内容

确认工作区只包含本次版本需要的修改：

```powershell
git status --short --branch
```

检查相对上一版本的完整差异：

```powershell
git diff v0.1.0 --
```

确认提交身份使用 GitHub noreply 邮箱：

```powershell
git config --get user.name
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
git diff --check
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

先更新 `CHANGELOG.md` 中的版本号和日期，再明确暂存本次发布文件。不要使用未经检查的
`git add .`。

```powershell
git add README.md README.zh-CN.md CHANGELOG.md CONTRIBUTING.md cursor-trail.js tests/cursor-trail.test.js .github/workflows/ci.yml docs/PUBLISHING.md
```

```powershell
git diff --cached --check
```

```powershell
git diff --cached --stat
```

```powershell
git commit -m "Release v0.1.1"
```

创建指向发布提交的附注标签：

```powershell
git tag -a v0.1.1 -m "v0.1.1"
```

核对提交和标签指向：

```powershell
git show --no-patch --decorate v0.1.1
```

## 4. 推送

一次推送主分支和附注标签：

```powershell
git push origin main --follow-tags
```

如果远程分支已经变化，Git 会拒绝非快进推送。不要使用强制推送；先检查远程新增内容。

## 5. 创建 GitHub Release

在仓库的 Releases 页面选择 `Draft a new release`：

- Tag：`v0.1.1`
- Title：`v0.1.1`
- Previous tag：`v0.1.0`
- Release notes：使用 `CHANGELOG.md` 中 `0.1.1` 的内容
- Pre-release：不勾选

发布后核对 Release 页面、`main` 分支和标签是否指向同一个提交，并确认 GitHub Actions
中的 CI 已通过。
