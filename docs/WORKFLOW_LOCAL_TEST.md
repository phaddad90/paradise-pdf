# Developer Workflow: Local Build & Test

To ensure stability and verify bug fixes (like the PDF corruption issues), follow these steps locally before pushing to GitHub.

## 1. Local Development Build
Run the app in dev mode for quick iteration:
```bash
npm install
npm run tauri dev
```

## 2. Local Production Build (The "Install" Test)
To verify it works as a standalone app (essential for testing file system/Adobe compatibility):
```bash
npm run tauri build
```
The resulting `.app` or `.dmg` will be in `src-tauri/target/release/bundle/`. 
**Always install and open this build manually to verify tool functionality (like Protect PDF) before committing.**

## 3. Commit & Push
Only after the manual install test passes:
```bash
git add .
git commit -m "feat/fix: descriptive message"
npm run version:bump  # if applicable
git push origin main
```
