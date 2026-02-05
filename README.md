# Paradise PDF

**Paradise PDF** is a native macOS utility app designed for fast file manipulation. It features a powerful batch file renamer and a PDF splitter tool.

Built with [Tauri v2](https://v2.tauri.app/), combining the performance of Rust with a React/Vite frontend.

**Version:** 2.0.0
**Author:** Peter Haddad

---

## Features

### 1. Batch File Renamer
Rename thousands of files instantly using a flexible pattern system.

- **Smart Numbering:** Use placeholders like `#` (1, 2…), `##` (01, 02…), or `{version}` for automatic numbering.
- **Pattern Example:** `Vacation-Photos-###` → `Vacation-Photos-001.jpg`, `Vacation-Photos-002.jpg`.
- **Conflict Detection:** Warns you if a rename will overwrite an existing file.
- **Live Preview:** See exactly how filenames will look before applying changes.
- **Drag & Drop:** Support for files and folders.

### 2. PDF Splitter
Easily break down large PDF documents into smaller files.

- **Split Every N Pages:** Automatically chunk a PDF (e.g., split every 5 pages).
- **One File Per Page:** Extract every single page into its own PDF file.
- **Preview:** See the resulting file structure before you split.

---

## Installation & Development

### Prerequisites
- Node.js (npm)
- [Rust](https://rustup.rs/) (cargo)

### Quick Start

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run in development mode:**
    ```bash
    npm run tauri:dev
    ```
    This launches the app window with hot-reloading enabled.

3.  **Build for production:**
    ```bash
    npm run tauri:build
    ```
    The native `.app` bundle will be generated in `src-tauri/target/release/bundle/macos/`.

---

## License

Dependencies have their own licenses. Code for this project is owned by Peter Haddad.
