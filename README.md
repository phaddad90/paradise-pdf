# Paradise PDF

**Paradise PDF** is a native macOS utility app designed for fast file manipulation and PDF operations.

Built with [Tauri v2](https://v2.tauri.app/), combining the performance of Rust with a React/Vite frontend.

**Version:** 3.6.2
**Author:** Peter Haddad

---

## Features

### 1. Batch File Renamer
Rename thousands of files instantly using a flexible pattern system.

- **Smart Numbering:** Use placeholders like `#` (1, 2…), `##` (01, 02…), or `{version}` for automatic numbering.
- **Conflict Detection:** Warns you if a rename will overwrite an existing file.
- **Live Preview:** See exactly how filenames will look before applying changes.
- **Drag & Drop:** Support for files and folders.

### 2. PDF Splitter
Break down large PDF documents into smaller files. Optimized for 4GB+ PDFs.

- **Split Every N Pages** or **One File Per Page**.
- **Preview** the resulting file structure before splitting.

### 3. PDF Merger
Combine multiple PDFs into a single document.

### 4. PDF Organiser
Reorder, delete, or insert blank pages with a drag-and-drop grid editor.

### 5. Rotate Pages
Batch rotate individual pages or all pages at once.

### 6. Alternate & Mix
Interleave pages from multiple PDFs (e.g., front/back scanning).

### 7. Page Box Inspector
Inspect MediaBox, CropBox, TrimBox, BleedBox, and ArtBox for every page.

### 8. Protect PDF
Password-protect PDFs with 128-bit RC4 encryption.

### 9. Property Viewer
View PDF metadata, fonts, image DPI, colorspace, and page dimensions.

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
