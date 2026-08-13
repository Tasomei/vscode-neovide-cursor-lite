# Contributing

Thanks for considering a contribution.

## Development

This project intentionally stays small:

- no build step,
- no npm dependency,
- one main JavaScript file,
- direct loading through Custom CSS and JS Loader.

Before opening a pull request:

1. Run a syntax check:

   ```bash
   node --check cursor-trail.js
   ```

2. Test in VS Code after running:

   ```txt
   Reload Custom CSS and JS
   ```

3. Keep changes focused. Avoid unrelated formatting churn.

## Style

- Keep runtime code dependency-free.
- Prefer readable browser JavaScript.
- Do not add network requests.
- Do not add file-system or command execution behavior.
- Keep user-facing configuration near the top of `cursor-trail.js`.

## Credits

If a change is based on another project or article, include a credit link in the pull request.
