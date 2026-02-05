# Roadmap — Mac Batch File Renamer (and PDF tools)

This doc captures planned features so the app can grow into a small **multi-tool** utility without big rewrites.

---

## Current (v1)

- **Batch file renamer** — Naming pattern with version placeholder, drop/select files or folder, rename in place.

---

## Planned tools (add as tools within the same app)

1. **File splitter**  
   Split one PDF into multiple files by page count:
   - “Split every N pages” (e.g. 1–5, 6–10, …)
   - Or “Split into X files” (evenly or by page ranges)

2. **File merger**  
   Merge multiple PDFs into a single PDF (order configurable, e.g. drag-to-reorder).

3. **Page size**  
   For a given PDF: show **size/dimensions of each page** (e.g. width × height in points or mm, and optional label like “A4”, “Letter”).

4. **PDF compression**  
   Compress PDFs to reduce file size (e.g. image downscale, object compression). Optionally usable in the same batch flow as the renamer (e.g. “Rename then compress PDFs”).

---

## Architecture notes for adding tools

- **Rust:** Keep a clear split:
  - **File layer** (existing): `list_files_from_paths`, paths, rename — shared by all tools.
  - **PDF layer** (v2): New commands/modules for split, merge, page-info, compress using a permissively licensed PDF crate (e.g. from crates.io).
- **Frontend:** Add a **tool chooser** (tabs or sidebar): “Batch rename” | “PDF splitter” | “PDF merger” | “Page size” | “PDF compression”. Each tool gets its own UI panel; shared: file/folder picker, drop zone, and status area.
- **Dependencies:** Use only public, permissively licensed PDF libraries (no private/paid APIs). Add PDF crates only when implementing the PDF tools.

This way we can continue with the current renamer and add the PDF tools incrementally without restructuring.
