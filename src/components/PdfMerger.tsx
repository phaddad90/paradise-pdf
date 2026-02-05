import React, { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { FileEntry } from "../types";

interface PdfMergerProps {
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
    onMergeComplete: () => void;
    // We need a way to update files in parent for reordering
    setFiles: (files: FileEntry[]) => void;
}

export function PdfMerger({
    files,
    onPickFiles,
    onPickFolder,
    onDrop: _onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
    setStatus,
    status,
    onMergeComplete,
    setFiles,
}: PdfMergerProps) {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleMerge = useCallback(async () => {
        if (files.length < 2) {
            setStatus({ type: "error", text: "Please select at least 2 PDF files to merge." });
            return;
        }

        try {
            const outputPath = await save({
                filters: [{ name: "PDF Document", extensions: ["pdf"] }],
                defaultPath: "Merged_Document.pdf",
            });

            if (!outputPath) return;

            setStatus({ type: "info", text: "Merging PDFs..." });

            await invoke("merge_pdfs", {
                paths: files.map((f) => f.path),
                outputPath,
            });

            setStatus({ type: "success", text: `Successfully merged ${files.length} files into:\n${outputPath}` });
            onMergeComplete();
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    }, [files, setStatus, onMergeComplete]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDragLeave(e);
        // We rely on the App.tsx global tauri://drag-drop handler and pickFiles to handle file adding (which now appends).
        // This prevents double-adding if both events fire, and keeps logic centralized.
    };

    // Basic Drag and Drop Reordering
    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
        // Transparent drag image or default? Default is fine.
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
            <h2 className="tool-title">PDF Merge</h2>

            <section className="section" aria-labelledby="merge-drop-label">
                <span id="merge-drop-label" className="label">Add PDFs to Merge</span>
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
                                onDragOver={(e) => e.preventDefault()} // Necessary to allow dropping
                                onDragEnter={() => onDragEnter(i)}
                                onDragEnd={onDragEnd}
                                className={draggedIndex === i ? "dragging" : ""}
                                style={{
                                    cursor: 'grab',
                                    padding: '8px',
                                    border: '1px solid var(--border-color)',
                                    marginBottom: '4px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-secondary)',
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
                    onClick={handleMerge}
                >
                    Merge {files.length} PDFs
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
