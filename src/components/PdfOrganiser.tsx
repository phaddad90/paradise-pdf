import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import * as pdfjs from "pdfjs-dist";
import { FileEntry, PageMetadata, PageAction } from "../types";

// Setup worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface DraggablePage {
    id: string; // unique id for dragging
    type: "existing" | "blank";
    page_number?: number;
    is_landscape?: boolean;
    previewUrl?: string;
}

interface PdfOrganiserProps {
    files: FileEntry[];
    onPickFiles: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onReset: () => void;
}

export function PdfOrganiser({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
}: PdfOrganiserProps) {
    const [pages, setPages] = useState<DraggablePage[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

    const file = files[0];

    const loadPdf = useCallback(async (path: string) => {
        setLoading(true);
        setStatus(null);
        try {
            const metadata = await invoke<PageMetadata[]>("get_organiser_pdf_metadata", { path });
            const buffer = await invoke<number[]>("read_pdf_buffer", { path });
            const uint8 = new Uint8Array(buffer);
            const loadingTask = pdfjs.getDocument({ data: uint8 });
            const pdf = await loadingTask.promise;

            const newPages: DraggablePage[] = [];
            for (const meta of metadata) {
                const page = await pdf.getPage(meta.page_number);
                const viewport = page.getViewport({ scale: 0.3 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (context) {
                    await page.render({ canvasContext: context, viewport, canvas }).promise;
                    newPages.push({
                        id: `page-${meta.page_number}-${Date.now()}`,
                        type: "existing",
                        page_number: meta.page_number,
                        is_landscape: meta.is_landscape,
                        previewUrl: canvas.toDataURL(),
                    });
                }
            }
            setPages(newPages);
        } catch (e) {
            setStatus({ type: "error", text: `Failed to load PDF: ${e}` });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (file) {
            loadPdf(file.path);
        } else {
            setPages([]);
            setSelectedIds(new Set());
        }
    }, [file, loadPdf]);

    const toggleSelection = (id: string, multi = false) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (multi) {
                if (next.has(id)) next.delete(id);
                else next.add(id);
            } else {
                next.clear();
                next.add(id);
            }
            return next;
        });
    };

    const selectSpecial = (criteria: string) => {
        const next = new Set<string>();
        if (criteria === "none") {
            setSelectedIds(next);
            return;
        }

        pages.forEach((p) => {
            if (criteria === "all") next.add(p.id);
            else if (criteria === "even" && p.page_number && p.page_number % 2 === 0) next.add(p.id);
            else if (criteria === "odd" && p.page_number && p.page_number % 2 !== 0) next.add(p.id);
            else if (criteria === "landscape" && p.is_landscape) next.add(p.id);
            else if (criteria === "portrait" && !p.is_landscape) next.add(p.id);
        });
        setSelectedIds(next);
    };

    const deleteSelected = () => {
        setPages((prev) => prev.filter((p) => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
    };

    const insertBlank = () => {
        const newBlank: DraggablePage = {
            id: `blank-${Date.now()}`,
            type: "blank",
        };

        if (selectedIds.size === 0) {
            setPages((prev) => [...prev, newBlank]);
        } else {
            const reversedIdx = [...pages].reverse().findIndex((p) => selectedIds.has(p.id));
            const lastSelectedIdx = reversedIdx === -1 ? -1 : pages.length - 1 - reversedIdx;
            setPages((prev) => {
                const next = [...prev];
                next.splice(lastSelectedIdx + 1, 0, newBlank);
                return next;
            });
        }
    };

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

    const onDragStart = (idx: number) => {
        setDraggedIdx(idx);
    };

    const onDragOverLocal = (e: React.DragEvent, idx: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === idx) return;

        setPages((prev) => {
            const next = [...prev];
            const [moved] = next.splice(draggedIdx, 1);
            next.splice(idx, 0, moved);
            return next;
        });
        setDraggedIdx(idx);
    };

    const saveChanges = async () => {
        if (!file) return;
        const outputPath = await save({
            defaultPath: file.path.replace(".pdf", "_organised.pdf"),
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (!outputPath) return;

        setLoading(true);
        setStatus({ type: "info", text: "Saving your document..." });

        try {
            const actions: PageAction[] = pages.map((p) =>
                p.type === "existing" ? { type: "existing", page_number: p.page_number! } : { type: "blank" }
            );

            await invoke("apply_pdf_organisation", {
                inputPath: file.path,
                actions,
                outputPath,
            });

            setStatus({ type: "success", text: "Document saved successfully!" });
        } catch (e) {
            setStatus({ type: "error", text: `Failed to save: ${e}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="tool-container">
            <div className="tool-header">
                <h2>PDF Organiser</h2>
                <div className="tool-controls">
                    <select onChange={(e) => selectSpecial(e.target.value)} defaultValue="">
                        <option value="" disabled>Select Pages...</option>
                        <option value="all">All Pages</option>
                        <option value="none">None</option>
                        <option value="even">Even Pages</option>
                        <option value="odd">Odd Pages</option>
                        <option value="landscape">Landscape Pages</option>
                        <option value="portrait">Portrait Pages</option>
                    </select>
                    <button onClick={insertBlank} className="btn-secondary">Insert Blank</button>
                    <button onClick={deleteSelected} className="btn-danger" disabled={selectedIds.size === 0}>
                        Delete ({selectedIds.size})
                    </button>
                    <button onClick={saveChanges} className="btn-primary" disabled={pages.length === 0 || loading}>
                        {loading ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={onReset} className="btn-secondary">Reset</button>
                </div>
            </div>

            {!file ? (
                <div
                    className={`drop-zone ${dragOver ? "active" : ""}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={onPickFiles}
                >
                    <p>Drop a PDF here to start organising</p>
                </div>
            ) : (
                <div className="organise-grid">
                    {pages.map((page, idx) => (
                        <div
                            key={page.id}
                            className={`page-thumb ${selectedIds.has(page.id) ? "selected" : ""} ${page.type === "blank" ? "blank" : ""}`}
                            onClick={(e) => toggleSelection(page.id, e.shiftKey || e.metaKey)}
                            draggable
                            onDragStart={() => onDragStart(idx)}
                            onDragOver={(e) => onDragOverLocal(e, idx)}
                        >
                            {page.type === "existing" ? (
                                <img src={page.previewUrl} alt={`Page ${page.page_number}`} />
                            ) : (
                                <div className="blank-placeholder">Blank Page</div>
                            )}
                            <div className="page-label">{idx + 1}</div>
                        </div>
                    ))}
                </div>
            )}

            {status && <div className={`status-message ${status.type}`}>{status.text}</div>}

            <style>{`
        .organise-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          max-height: 60vh;
          overflow-y: auto;
        }
        .page-thumb {
          position: relative;
          border: 2px solid transparent;
          border-radius: 4px;
          padding: 4px;
          background: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          cursor: pointer;
          transition: transform 0.2s;
        }
        .page-thumb:hover {
          transform: translateY(-2px);
        }
        .page-thumb.selected {
          border-color: #007aff;
          background: #eef6ff;
        }
        .page-thumb img {
          width: 100%;
          height: auto;
          display: block;
        }
        .blank-placeholder {
          width: 100%;
          aspect-ratio: 1 / 1.414;
          background: #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          color: #666;
          border: 1px dashed #999;
        }
        .page-label {
          margin-top: 4px;
          text-align: center;
          font-size: 0.75rem;
          color: #666;
        }
        .btn-danger {
          background: #ff3b30;
          color: white;
        }
        .btn-danger:disabled {
          background: #ff3b3055;
        }
      `}</style>
        </div>
    );
}
