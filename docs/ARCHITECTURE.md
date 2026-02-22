# Paradise PDF - Architecture & Development Guide

**Current Version**: 3.6.2
**Stack**: Tauri v2, React + Vite, Rust (lopdf)

## 1. System Overview

This application follows a standard **Tauri Hybrid Architecture**:
-   **Frontend (UI)**: React (TypeScript) running in a WebView. Handles user interaction, state management, and file previews.
-   **Backend (Core)**: Rust system layer. Handles heavy file I/O, PDF binary manipulation, and native dialogs.

### Communication
-   **Commands**: The Frontend invokes Rust functions via `@tauri-apps/api/core`'s `invoke` command.
-   Example: `invoke('apply_pdf_organisation', { ... })`

## 2. Key Modules

### A. PDF Manipulation (`src-tauri/src/lib.rs`)
The core value proposition. We use `lopdf` (locally patched for 64-bit offset support) for low-level PDF editing.

**CRITICAL STRATEGY: Safe Tree Flattening**
*Problem*: standard `lopdf` examples often suggest deep-cloning documents to split/merge them. This is prone to corruption if resources (Fonts, XObjects) are referenced indirectly.
*Solution*: We use **in-place modification** where possible.
-   **Organiser**: We load the doc, create a *new* Page Tree structure matching the user's desired order, and reparent existing Page objects to it. We do *not* copy Page objects; we just move their references.
-   **Splitter**: Uses `extract_pages` to copy only required objects. Memory-mapped file loading for 4GB+ PDFs.

### B. Active Tools
| Tool | Component | Backend Command |
|------|-----------|----------------|
| Batch File Renamer | `BulkRenamer.tsx` | `batch_rename` |
| PDF Splitter | `PdfSplitter.tsx` | `split_pdf` |
| PDF Merger | `PdfMerger.tsx` | `merge_pdfs` |
| PDF Organiser | `PdfOrganiser.tsx` | `apply_pdf_organisation` |
| Rotate Pages | `PdfRotator.tsx` | `rotate_pdf_pages` |
| Alternate & Mix | `PdfMixer.tsx` | `mix_pdfs` |
| Page Box Inspector | `PageBoxInspector.tsx` | `get_page_boxes` |
| Protect PDF | `PdfProtect.tsx` | `protect_pdf` |
| Property Viewer | `PdfPropertyViewer.tsx` | `get_pdf_properties` |

### C. PDF Organiser UI (`src/components/PdfOrganiser.tsx`)
A grid-based editor allowing users to reorder, delete, and insert blank pages.

**Interaction Model**:
-   **Drag-and-Drop**: Uses `@dnd-kit` for sortable grid.
-   **Selection**: Supports Cmd+Click (toggle), Shift+Click (range), and single click.
-   **Undo/Redo**: Cmd+Z / Cmd+Shift+Z with history stack.

## 3. Development Workflow

### Adding a new PDF Feature
1.  **Backend**: Define a command in `lib.rs` (e.g., `#[tauri::command] fn extract_text(...)`).
    -   *Rule*: Always return `AppResult<T>` to handle errors gracefully.
2.  **Frontend**: Create a wrapper in `src/types.ts` if complex data structures are passed.
3.  **UI**: Implement the visual component.

### Debugging
-   **Frontend**: Devtools are only available in dev builds (gated behind `devtools` cargo feature).
-   **Backend**: Use `println!` (stdout appears in your terminal) or return detailed error strings.

## 4. Deployment
-   **CI/CD**: `.github/workflows/release.yml`
-   **Trigger**: Push a tag `v*` (e.g. `v3.6.2`).
-   **Process**: Builds, Signs (Apple ID), and Uploads to GitHub Releases.
-   **Auto-update**: Enabled via `tauri-plugin-updater` with public key signing.
