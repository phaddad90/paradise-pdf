# Roadmap — Paradise PDF

This doc captures planned features so the app can grow into a **multi-tool** PDF utility.

---

## Current (v3.3.x)

- ✅ Batch file renamer
- ✅ PDF Splitter
- ✅ PDF Merger
- ✅ PDF Rotator
- ✅ PDF Organiser (reorder/delete/add blank)
- ✅ Page Box Inspector
- ✅ Alternate & Mix
- 🔄 Unlock PDF (v3.4.0)
- 🔄 Protect PDF (v3.4.0)

---

## Planned Tools (Priority Order)

### High Priority
1. **Edit Text in PDF** — Direct text editing in PDFs
2. **Compress PDFs** — Reduce file size via image downscaling
3. **Watermarks** — Add text/image watermarks

### Medium Priority
4. **Page Numbers / Headers / Footers** — Batch add to PDFs
5. **Convert PDF ↔ Images** — PDF to JPG/PNG and vice versa
6. **Fill & Sign Forms** — Form filling with signature support
7. **Add Annotations** — Highlight, underline, notes

### Lower Priority (Complex)
8. **OCR** — Convert scanned PDFs to searchable text
9. **Convert PDF ↔ Word/Excel** — Office format conversion
10. **Repair Corrupt PDFs** — Attempt to fix damaged PDFs

---

## Architecture Notes

- **Rust:** Keep a clear split:
  - **File layer**: `list_files_from_paths`, paths, rename — shared by all tools.
  - **PDF layer**: Commands for PDF manipulation using `lopdf`.
- **Frontend:** Tool chooser + shared drop zone/status area.
- **Dependencies:** Use only permissively licensed libraries.
