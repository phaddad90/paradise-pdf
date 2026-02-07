import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileEntry } from "../types";
import * as pdfjsLib from "pdfjs-dist";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfRotatorProps {
    files: FileEntry[];
    onPickFiles: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onReset: () => void;
    setStatus: (status: { type: "success" | "error" | "info"; text: string } | null) => void;
    status: { type: "success" | "error" | "info"; text: string } | null;
}

export function PdfRotator({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
    setStatus,
    status,
}: PdfRotatorProps) {
    const activeFile = files.length > 0 ? files[0] : null;
    const [pageCount, setPageCount] = useState<number>(0);
    const [rotations, setRotations] = useState<{ [page: number]: number }>({});
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const canvasRefs = useRef<{ [page: number]: HTMLCanvasElement | null }>({});
    const renderTasksRef = useRef<{ [page: number]: any }>({});

    // Reset rotations when file changes
    useEffect(() => {
        setRotations({});
        setPageCount(0);
        canvasRefs.current = {};
    }, [activeFile?.path]);

    // Load PDF and render thumbnails
    useEffect(() => {
        if (!activeFile) return;

        const loadPdf = async () => {
            setLoading(true);
            try {
                // Convert file path to file URL/array buffer.
                // In Tauri, we can use `convertFileSrc` or read binary.
                // Or since we have local access, we might just use the file object if we had it.
                // BUT `activeFile` is a `FileEntry` struct (path/name) from Rust, not a JS File object.
                // We need to read the file content.
                // OPTION A: Use Tauri `fs.readBinaryFile` (needs fs plugin, restricted)
                // OPTION B: Use generic `convertFileSrc` from tauri core to get a URL for the webview.
                // In v2, `convertFileSrc` is in `@tauri-apps/api/core` as `convertFileSrc`.

                // Load file as binary buffer from backend to avoid asset:// protocol issues in pdf.js
                // We assume the file is reasonable size for memory.
                const data = await invoke<number[]>("read_pdf_buffer", { path: activeFile.path });
                const uint8Array = new Uint8Array(data);

                const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
                const pdf = await loadingTask.promise;
                setPageCount(pdf.numPages);

                // Render pages
                for (let i = 1; i <= pdf.numPages; i++) {
                    renderPage(pdf, i);
                }
            } catch (e: any) {
                setStatus({ type: "error", text: "Failed to load PDF: " + e.message });
            } finally {
                setLoading(false);
            }
        };

        const renderPage = async (pdf: any, pageNum: number) => {
            try {
                const page = await pdf.getPage(pageNum);
                // 1.0 scale = 72 DPI (usually)
                // We want 144 DPI -> scale 2.0
                // User asked for preview, 144 DPI is high quality.
                const scale = 2.0;
                const hiresViewport = page.getViewport({ scale });

                const canvas = canvasRefs.current[pageNum];
                if (canvas) {
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = hiresViewport.height;
                        canvas.width = hiresViewport.width;

                        // Visual style: fit in grid card
                        // We handle sizing in CSS.

                        const renderContext = {
                            canvasContext: context,
                            viewport: hiresViewport,
                        };

                        // Cancel previous
                        if (renderTasksRef.current[pageNum]) {
                            renderTasksRef.current[pageNum].cancel();
                        }

                        const task = page.render(renderContext);
                        renderTasksRef.current[pageNum] = task;
                        await task.promise;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };

        loadPdf();

        return () => {
            // Cleanup if needed
            Object.values(renderTasksRef.current).forEach(t => t.cancel());
        };
    }, [activeFile, setStatus, refreshKey]);

    const rotatePage = (pageNum: number, angle: number) => {
        setRotations(prev => ({
            ...prev,
            [pageNum]: (prev[pageNum] || 0) + angle
        }));
    };

    const rotateAll = (angle: number) => {
        if (!pageCount) return;
        setRotations(prev => {
            const newRotations = { ...prev };
            for (let i = 1; i <= pageCount; i++) {
                newRotations[i] = (newRotations[i] || 0) + angle;
            }
            return newRotations;
        });
    };

    const handleSave = async () => {
        if (!activeFile) return;
        try {
            setStatus({ type: "info", text: "Rotating pages..." });

            const rustMap: Record<number, number> = {};
            for (const [k, v] of Object.entries(rotations)) {
                let r = v % 360;
                if (r < 0) r += 360;
                if (r !== 0) rustMap[Number(k)] = r;
            }

            if (Object.keys(rustMap).length === 0) {
                setStatus({ type: "info", text: "No changes to save." });
                return;
            }

            await invoke("rotate_pdf_pages", {
                path: activeFile.path,
                rotations: rustMap
            });

            setStatus({ type: "success", text: "Saved successfully!" });
            setRotations({});
            setRefreshKey(k => k + 1);
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="tool-title" style={{ margin: 0 }}>Rotate Pages</h2>
                {activeFile && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => rotateAll(-90)}>↺ All Left</button>
                        <button className="btn btn-secondary" onClick={() => rotateAll(90)}>↻ All Right</button>
                    </div>
                )}
            </div>

            <section className="section">
                <div
                    className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={onPickFiles}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") onPickFiles();
                    }}
                >
                    {activeFile ? (
                        <p className="primary">Rotating: <strong>{activeFile.name}</strong></p>
                    ) : (
                        <>
                            <p className="primary">Drop a PDF here to rotate pages</p>
                            <p>or click to select</p>
                        </>
                    )}
                </div>
            </section>

            {loading && <div style={{ textAlign: 'center', padding: 20 }}>Loading Preview...</div>}

            {activeFile && pageCount > 0 && (
                <section className="section">
                    <div className="thumbnail-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: 16,
                        maxHeight: '400px',
                        overflowY: 'auto',
                        padding: '4px'
                    }}>
                        {Array.from({ length: pageCount }, (_, i) => i + 1).map(pageNum => {
                            const rotation = rotations[pageNum] || 0;
                            return (
                                <div key={pageNum} className="page-card" style={{ textAlign: 'center' }}>
                                    <div className="canvas-wrapper" style={{
                                        width: '100%',
                                        height: '180px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: 4,
                                        marginBottom: 8,
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}>
                                        <canvas
                                            ref={el => { if (el) canvasRefs.current[pageNum] = el }}
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                transition: 'transform 0.3s ease',
                                                transform: `rotate(${rotation}deg)`
                                            }}
                                        />
                                        {/* Overlay controls */}
                                        <div className="card-overlay" style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            background: 'rgba(0,0,0,0.5)',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            padding: 4,
                                            gap: 8
                                        }}>
                                            <button
                                                style={{ padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
                                                onClick={() => rotatePage(pageNum, -90)}
                                            >↺</button>
                                            <button
                                                style={{ padding: '2px 6px', fontSize: '12px', cursor: 'pointer' }}
                                                onClick={() => rotatePage(pageNum, 90)}
                                            >↻</button>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Page {pageNum}</span>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            <div className="actions">
                <button
                    className="btn btn-primary"
                    disabled={!activeFile || Object.keys(rotations).length === 0 || Object.values(rotations).every(r => r % 360 === 0)}
                    onClick={handleSave}
                >
                    Save Rotation
                </button>
                <button
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
