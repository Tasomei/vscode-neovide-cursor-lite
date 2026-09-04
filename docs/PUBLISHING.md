# Publishing Guide

这是给维护者看的发布清单。只需要 Git，不需要 GitHub CLI。

下面的命令假设你的本地仓库在一个固定目录。路径可以按自己的实际位置调整，例如：

```txt
C:\Users\your-name\vscode-neovide-cursor-lite
```

## 1. 配置 Git 身份

先检查：

```powershell
git config --global --get user.name
git config --global --get user.email
```

如果为空，设置成你的 GitHub 用户名和 noreply 邮箱：

```powershell
git config --global user.name "YOUR_USERNAME"
git config --global user.email "YOUR_ID+YOUR_USERNAME@users.noreply.github.com"
```

noreply 邮箱在这里看：

```txt
GitHub -> Settings -> Emails -> Keep my email addresses private
```

建议保持这两个开关打开：

```txt
Keep my email addresses private
Block command line pushes that expose my email
```

这样不容易把真实邮箱塞进提交历史里。

## 2. 发布前检查隐私

在仓库目录执行：

```powershell
cd C:\Users\your-name\vscode-neovide-cursor-lite
rg -n -i "gmail|AppData|C:\\Users|Temp|token|secret|password|api[_-]?key|private[_-]?key|github_pat_|ghp_" .
```

正常情况下不应该出现真实邮箱、真实本机用户名、token、密钥。命中 `your-name` 这类占位示例是正常的。

再检查脚本有没有危险 API：

```powershell
rg -n -i "fetch|XMLHttpRequest|WebSocket|eval\\s*\\(|new\\s+Function|require\\s*\\(|child_process|fs\\.|document\\.cookie|localStorage|sessionStorage|navigator\\.clipboard|innerHTML" cursor-trail.js
```

这个项目的脚本不应该命中这些内容。

最后做语法检查和内置回归测试：

```powershell
node --check cursor-trail.js
```

```powershell
node --test
```

语法检查没有输出就是好消息；回归测试应显示所有测试通过。命令行有时候很冷淡，但冷淡也可以是稳定。

## 3. 提交本地仓库

```powershell
cd C:\Users\your-name\vscode-neovide-cursor-lite
git status
git add .
git commit -m "Initial release"
```

如果 Git 提醒没有配置用户名或邮箱，回到第 1 步。

## 4. 在 GitHub 网页创建仓库

打开：

```txt
https://github.com/new
```

推荐设置：

```txt
Repository name: vscode-neovide-cursor-lite
Description: Lightweight Neovide-like cursor animation for VS Code via Custom CSS and JS Loader.
Visibility: Public
```

不要勾选这些：

```txt
Add a README file
Add .gitignore
Choose a license
```

因为本地已经有了。

## 5. 连接远程仓库并推送

GitHub 创建仓库后会给你一段命令。一般类似：

```powershell
git remote add origin https://github.com/YOUR_USERNAME/vscode-neovide-cursor-lite.git
git push -u origin main
```

如果第一次 push 弹出登录窗口，正常登录 GitHub 即可。

## 6. 添加 Topics

在 GitHub 仓库页面添加 topics：

```txt
vscode
cursor
neovide
animation
javascript
monaco-editor
custom-css
```

## 7. 打开私密漏洞报告

`SECURITY.md` 让报告者走仓库的私密漏洞报告入口，但这个功能默认是关闭的，需要手动打开：

```txt
仓库 Settings -> 找到 Security 分组 -> Private vulnerability reporting -> Enable
```

不打开的话，读者按 `SECURITY.md` 的指引点进 Security 标签页会找不到报告入口，只能被迫开公开 issue。

## 8. 创建第一个 Release

打开仓库页面：

```txt
Releases -> Draft a new release
```

填写：

```txt
Tag: v0.1.0
Title: v0.1.0 - Initial release
```

Release notes：

```md
Initial release of VS Code Neovide Cursor Lite.

- Canvas-based caret overlay with spring-driven four-corner deformation.
- Caret colour follows the VS Code theme.
- Render loop suspends while the caret is idle.
- Consistent animation on 60Hz and high-refresh-rate displays.
- Single file, no build step, no npm dependency.
```

然后发布。

## 9. VS Code 更新后的维护说明

VS Code 更新可能会让 Custom CSS and JS Loader 的注入失效。

用户只需要：

```txt
Enable Custom CSS and JS
Reload Custom CSS and JS
```

然后重启 VS Code。
