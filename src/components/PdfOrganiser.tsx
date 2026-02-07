import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import * as pdfjs from "pdfjs-dist";
import { FileEntry, PageMetadata, PageAction } from "../types";

// Setup worker
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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
    const [saving, setSaving] = useState(false);
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

        pages.forEach((p, idx) => {
            const displayNum = idx + 1;
            if (criteria === "all") next.add(p.id);
            else if (criteria === "even" && displayNum % 2 === 0) next.add(p.id);
            else if (criteria === "odd" && displayNum % 2 !== 0) next.add(p.id);
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

        setSaving(true);
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
            setSaving(false);
        }
    };

    return (
        <div className="tool-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 className="tool-title" style={{ margin: 0 }}>PDF Organiser</h2>
                {file && (
                    <div className="tool-controls" style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onReset} className="btn btn-secondary">Reset</button>
                    </div>
                )}
            </div>

            {!file ? (
                <section className="section">
                    <div
                        className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onClick={onPickFiles}
                    >
                        <p className="primary">Drop a PDF here to start organising</p>
                        <p>or click to select</p>
                    </div>
                </section>
            ) : (
                <>
                    <section className="section" style={{ background: 'rgba(255,255,255,0.5)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                                className="input"
                                style={{ width: 'auto', minWidth: 160 }}
                                onChange={(e) => selectSpecial(e.target.value)}
                                defaultValue=""
                            >
                                <option value="" disabled>Select Pages...</option>
                                <option value="all">All Pages</option>
                                <option value="none">None</option>
                                <option value="even">Even Pages</option>
                                <option value="odd">Odd Pages</option>
                                <option value="landscape">Landscape Pages</option>
                                <option value="portrait">Portrait Pages</option>
                            </select>

                            <button onClick={insertBlank} className="btn btn-secondary">
                                <span style={{ marginRight: 4 }}>+</span> Blank
                            </button>

                            <button
                                onClick={deleteSelected}
                                className="btn"
                                style={{
                                    background: selectedIds.size > 0 ? 'rgba(220, 38, 38, 0.1)' : 'var(--surface)',
                                    color: selectedIds.size > 0 ? 'var(--error)' : 'var(--text-secondary)',
                                    border: `1px solid ${selectedIds.size > 0 ? 'rgba(220, 38, 38, 0.2)' : 'var(--border)'}`
                                }}
                                disabled={selectedIds.size === 0}
                            >
                                Delete ({selectedIds.size})
                            </button>

                            <div style={{ flex: 1 }} />

                            <button
                                onClick={saveChanges}
                                className="btn btn-primary"
                                disabled={pages.length === 0 || saving || loading}
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </section>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                            <div className="loading-spinner" style={{ marginBottom: 12 }}>⌛</div>
                            Loading Previews...
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
                                    <div className="thumb-container">
                                        {page.type === "existing" ? (
                                            <img src={page.previewUrl} alt={`Page ${page.page_number}`} />
                                        ) : (
                                            <div className="blank-placeholder">
                                                <div style={{ opacity: 0.3, fontSize: '24px' }}>📄</div>
                                                <span>Blank</span>
                                            </div>
                                        )}
                                        <div className="page-number-badge">{idx + 1}</div>
                                        {selectedIds.has(page.id) && <div className="selection-check">✓</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {status && <div className={`status ${status.type}`} style={{ marginTop: 20 }}>{status.text}</div>}

            <style>{`
        .organise-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 20px;
          padding: 24px;
          background: rgba(255, 255, 255, 0.4);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          max-height: 50vh;
          overflow-y: auto;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .page-thumb {
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.1), filter 0.2s;
        }
        
        .page-thumb:hover {
          transform: translateY(-4px);
        }
        
        .thumb-container {
          position: relative;
          background: white;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 6px;
          box-shadow: var(--shadow-soft);
          aspect-ratio: 0.75;
          display: flex;
          flex-direction: column;
        }
        
        .page-thumb.selected .thumb-container {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent), var(--shadow);
          background: var(--bg-subtle);
        }
        
        .thumb-container img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 4px;
        }
        
        .blank-placeholder {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          border: 1px dashed var(--border);
          border-radius: 4px;
          color: var(--text-secondary);
          font-size: 11px;
          gap: 4px;
        }
        
        .page-number-badge {
          position: absolute;
          top: -8px;
          left: -8px;
          background: var(--text);
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          z-index: 10;
        }
        
        .selection-check {
          position: absolute;
          top: -8px;
          right: -8px;
          background: var(--accent);
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 10px;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          z-index: 10;
        }

        .loading-spinner {
          display: inline-block;
          animation: spin 2s linear infinite;
          font-size: 24px;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
