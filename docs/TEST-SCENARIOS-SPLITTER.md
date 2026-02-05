# Manual test scenarios — PDF Splitter (v2 first slice)

Use these to manually verify the PDF Splitter. Same file import as Bulk Renaming: drop zone, Select files, Select folder.

---

## 1. Import (shared UX)

- **1.1** Open **Tools → PDF Splitter**. Drop zone shows: “Drop files or folder here”, “Select files”, “Select folder”, “Only PDFs will be used.”
- **1.2** Click **Select files**, pick one or more PDFs. List shows “N PDF(s) selected” and only PDF file names.
- **1.3** Click **Select folder**, pick a folder that contains PDFs. List shows all files from that folder that are PDFs (non-PDFs are ignored).
- **1.4** Drag and drop a PDF onto the drop zone. It appears in the list. Drop a mix of PDF and non-PDF: only PDFs appear in the list.

---

## 2. Split every N pages

- **2.1** Select one PDF (e.g. 12 pages). Leave **Split every** at 5. Preview shows something like: `doc_part1.pdf (pages 1–5)`, `doc_part2.pdf (pages 6–10)`, `doc_part3.pdf (pages 11–12)`.
- **2.2** Change N to 1. Preview shows one output per page (same as “One file per page”).
- **2.3** Change N to 20 (more than page count). Preview shows one file with all pages (e.g. `doc_part1.pdf (pages 1–12)`).
- **2.4** Click **Split**. With default “Same folder as each PDF”: new files appear in the same folder as the source; names like `OriginalName_part1.pdf`, `OriginalName_part2.pdf`. Success message: “Created N files.”

---

## 3. One file per page

- **3.1** Select one PDF (e.g. 3 pages). Choose **One file per page**. Preview shows `doc_part1.pdf (pages 1)`, `doc_part2.pdf (pages 2)`, `doc_part3.pdf (pages 3)`.
- **3.2** Click **Split** (default output folder). Same folder as source now contains `doc_part1.pdf`, `doc_part2.pdf`, `doc_part3.pdf`. Open and confirm each has one page.

---

## 4. Output folder

- **4.1** Select one PDF. Choose **Choose folder** and pick a different folder. Preview unchanged; click **Split**. New part files appear in the chosen folder, not next to the source.
- **4.2** Select **Same folder as each PDF** again. Split again (e.g. different PDF or re-split): new files go next to the source PDF.

---

## 5. Multiple PDFs (batch)

- **5.1** Select two or more PDFs (e.g. 3 pages and 5 pages). Split every 2 pages. Preview shows both sources: first → 2 parts, second → 3 parts.
- **5.2** Click **Split** with default output. First PDF’s parts in its folder, second PDF’s parts in its folder. Success: “Created 5 files” (or total count).
- **5.3** Select two PDFs. **Choose folder** and pick one folder. Split. All part files (from both PDFs) appear in that one folder; names like `doc1_part1.pdf`, `doc1_part2.pdf`, `doc2_part1.pdf`, …

---

## 6. Edge cases and errors

- **6.1** Select a non-PDF (e.g. .txt). It does not appear in the PDF list (only PDFs used).
- **6.2** Select one PDF, split. Without resetting, add another PDF and split again: second split works; success message reflects second run.
- **6.3** Click **Reset**. List clears, output folder resets to “Same folder”, preview clears. Can select new files and split again.
- **6.4** Corrupted or password-protected PDF: expect an error message when preview or split runs (no crash).

---

## 7. Tool switch

- **7.1** On PDF Splitter, select a PDF. Switch to **Tools → PDF Bulk Renaming**. Renamer UI shows; no PDF list. Switch back to **Tools → PDF Splitter**: same PDF(s) still selected, preview still correct.
- **7.2** After a successful split, switch to Bulk Renaming and back: splitter shows empty state (files were cleared on success).

---

## Quick checklist

| # | Scenario | Pass/Fail |
|---|----------|-----------|
| 1.1–1.4 | Import (files, folder, drag-drop, PDF-only) | |
| 2.1–2.4 | Split every N (preview + split, default folder) | |
| 3.1–3.2 | One file per page | |
| 4.1–4.2 | Choose folder vs same folder | |
| 5.1–5.3 | Multiple PDFs, default and custom output | |
| 6.1–6.4 | Non-PDF, reset, errors | |
| 7.1–7.2 | Tool switch | |
