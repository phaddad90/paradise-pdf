import React, { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { FileEntry } from "../types";

interface PdfMixerProps {
    files: FileEntry[];
    onPickFiles: () => void;
    onPickFolder: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onReset: () => void;
    setStatus: (status: { type: "success" | "error" | "info"; text: string } | null) => void;
    status: { type: "success" | "error" | "info"; text: string } | null;
    onMixComplete: () => void;
    setFiles: (files: FileEntry[]) => void;
}

export function PdfMixer({
    files,
    onPickFiles,
    onPickFolder,
    onDrop: _onDrop, // unused in direct handler, handled by App wrapper usually or we rely on the prop
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
    setStatus,
    status,
    onMixComplete,
    setFiles,
}: PdfMixerProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleMix = useCallback(async () => {
        if (files.length < 2) {
            setStatus({ type: "error", text: "Please select at least 2 PDF files to mix." });
            return;
        }

        try {
            const outputPath = await save({
                filters: [{ name: "PDF Document", extensions: ["pdf"] }],
                defaultPath: "Mixed_Document.pdf",
            });

            if (!outputPath) return;

            setStatus({ type: "info", text: "Mixing PDFs..." });

            await invoke("mix_pdfs", {
                paths: files.map((f) => f.path),
                outputPath,
            });

            setStatus({ type: "success", text: `Successfully mixed ${files.length} files into:\n${outputPath}` });
            onMixComplete();
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    }, [files, setStatus, onMixComplete]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDragLeave(e);
        // App.tsx handles the file loading via tauri://drag-drop event usually, but if we wanted custom drop logic:
        // For now, we rely on the prop 'onDrop' or the global listener.
        // Actually, PdfMerger's handleDrop calls onDragLeave and prevents defaults.
    };

    // Drag and Drop Reordering (Identical to PdfMerger)
    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const onDragEnter = (index: number) => {
        if (draggedIndex === null || draggedIndex === index) return;
        const newFiles = [...files];
        const item = newFiles[draggedIndex];
        newFiles.splice(draggedIndex, 1);
        newFiles.splice(index, 0, item);
        setFiles(newFiles);
        setDraggedIndex(index);
    };

    const onDragEnd = () => {
        setDraggedIndex(null);
    };

    return (
        <>
            <div className="tool-header">
                <h2 className="tool-title">Alternate & Mix</h2>
            </div>

            <section className="section" aria-labelledby="mix-drop-label">
                <span id="mix-drop-label" className="label">Add PDFs to Mix</span>
                <p className="hint" style={{ marginBottom: 10 }}>
                    Pages will be taken in order: Page 1 from File A, Page 1 from File B... Page 2 from File A, etc.
                </p>
                <div
                    className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                    onDrop={handleDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={onPickFiles}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            onPickFiles();
                        }
                    }}
                >
                    <p className="primary">Drop files here to append</p>
                    <p className="hint">
                        <button type="button" className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); onPickFiles(); }}>Add Files</button>
                        <button type="button" className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={(e) => { e.stopPropagation(); onPickFolder(); }}>Add Folder</button>
                    </p>
                </div>
            </section>

            {files.length > 0 && (
                <section className="section">
                    <span className="label">Order of Files (Drag to Reorder)</span>
                    <ul className="file-list reorder-list" style={{ listStyle: 'none', padding: 0 }}>
                        {files.map((f, i) => (
                            <li
                                key={`${f.path}`}
                                draggable
                                onDragStart={(e) => onDragStart(e, i)}
                                onDragOver={(e) => e.preventDefault()}
                                onDragEnter={() => onDragEnter(i)}
                                onDragEnd={onDragEnd}
                                className={`draggable-item ${draggedIndex === i ? "dragging" : ""}`}
                                style={{
                                    opacity: draggedIndex === i ? 0.5 : 1
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={{ marginRight: 8, color: 'var(--text-secondary)' }}>☰</span>
                                    {f.name}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="actions">
                <button
                    type="button"
                    className="btn btn-primary"
                    disabled={files.length < 2}
                    onClick={handleMix}
                >
                    Mix {files.length} PDFs
                </button>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onReset}
                >
                    Reset
                </button>
            </div>

            {status && (
                <div className={`status ${status.type}`} role="status">
                    {status.text}
                </div>
            )}
        </>
    );
}
