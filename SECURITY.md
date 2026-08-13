# Security Policy

## Supported Versions

This project is a single local JavaScript file. Only the latest release and the current `main`
branch are supported.

## Security Notes

Custom CSS and JS Loader injects JavaScript into VS Code's workbench. Only load scripts you understand
and trust.

This project should be loaded from a local file path, for example:

```json
"vscode_custom_css.imports": [
  "file:///C:/Users/your-name/vscode-neovide-cursor-lite/cursor-trail.js"
]
```

Avoid remote URLs in `vscode_custom_css.imports`.

## Reporting A Vulnerability

Please report security issues privately, through the repository's Security tab
(`Security` -> `Report a vulnerability`), rather than opening a public issue. A public issue
discloses the problem before there is a fix.

Include:

- a short description,
- reproduction steps,
- the VS Code version,
- the extension/version used for custom CSS injection.

Do not include private tokens, credentials, or sensitive local file paths in the report.
