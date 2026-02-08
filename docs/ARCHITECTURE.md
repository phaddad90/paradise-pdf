# Paradise PDF - Architecture & Development Guide

**Current Version**: 3.0.4  
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
The core value proposition. We use `lopdf` for low-level PDF editing.

**CRITICAL STRATEGY: Safe Tree Flattening**
*Problem*: standard `lopdf` examples often suggest deep-cloning documents to split/merge them. This is prone to corruption if resources (Fonts, XObjects) are referenced indirectly.
*Solution*: We use **in-place modification** where possible.
-   **Organiser**: We load the doc, create a *new* Page Tree structure matching the user's desired order, and reparent existing Page objects to it. We do *not* copy Page objects; we just move their references.
-   **Splitter**: We clone the document and prune *unwanted* pages.

### B. PDF Organiser UI (`src/components/PdfOrganiser.tsx`)
A grid-based editor allowing users to reorder, rotate, and delete pages.

**Interaction Model**:
-   **Drag-and-Drop**: Uses standard HTML5 DnD API.
-   **State**: "Drop-to-Insert". We track the `dropTarget` (index + position 'before'/'after') rather than live-swapping, to avoid UI flickering.

## 3. Development Workflow

### Adding a new PDF Feature
1.  **Backend**: Define a command in `lib.rs` (e.g., `#[tauri::command] fn extract_text(...)`).
    -   *Rule*: Always return `AppResult<T>` to handle errors gracefully.
2.  **Frontend**: Create a wrapper in `src/types.ts` if complex data structures are passed.
3.  **UI**: Implement the visual component.

### Debugging
-   **Frontend**: Use Chrome DevTools (Right click -> Inspect).
-   **Backend**: Use `println!` (stdout appears in your terminal) or return detailed error strings.

## 4. Deployment
-   **CI/CD**: `.github/workflows/release.yml`
-   **Trigger**: Push a tag `v*` (e.g. `v3.0.5`).
-   **Process**: Builds, Signs (Apple ID), and Uploads to GitHub Releases.
