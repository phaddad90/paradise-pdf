import React, { useCallback, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FileEntry, SplitPreviewResult } from "../types";

interface PdfSplitterProps {
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
    onSplitComplete: () => void;
}

export function PdfSplitter({
    files,
    onPickFiles,
    onPickFolder,
    onDrop,
    onDragOver, // Explicitly accepting these to wire up correctly
    onDragLeave,
    dragOver,
    onReset,
    setStatus,
    status,
    onSplitComplete,
}: PdfSplitterProps) {
    const [splitMode, setSplitMode] = useState<"every_n" | "one_per_page">("every_n");
    const [splitEveryN, setSplitEveryN] = useState(1);
    const [outputDir, setOutputDir] = useState<string | null>(null);
    const [splitPreviews, setSplitPreviews] = useState<SplitPreviewResult[]>([]);

    useEffect(() => {
        if (files.length === 0) {
            setSplitPreviews([]);
            return;
        }
        const mode =
            splitMode === "one_per_page"
                ? { mode: "one_per_page" as const }
                : { mode: "every_n" as const, n: Math.max(1, splitEveryN) };
        let cancelled = false;
        (async () => {
            const results: SplitPreviewResult[] = [];
            for (const f of files) {
                if (cancelled) return;
                try {
                    const r = await invoke<SplitPreviewResult>("split_pdf_preview", {
                        path: f.path,
                        mode,
                    });
                    results.push(r);
                } catch (e) {
                    let debug_info = "";
                    try {
                        const diag = await invoke<any>("debug_pdf_structure", { path: f.path });
                        debug_info = `Size: ${diag.file_size} bytes\n\n[Header]\n${diag.header}\n\n[Trailer]\n${diag.trailer}`;
                    } catch (diagErr) {
                        debug_info = `Failed to get diagnostics: ${diagErr}`;
                    }

                    results.push({
                        source_name: f.name,
                        page_count: 0,
                        parts: [],
                        error: String(e),
                        debug_info,
                    });
                }
            }
            if (!cancelled) setSplitPreviews(results);
        })();
        return () => {
            cancelled = true;
        };
    }, [files, splitMode, splitEveryN]);

    const handleSplit = useCallback(async () => {
        if (files.length === 0) return;
        setStatus(null);
        const mode =
            splitMode === "one_per_page"
                ? { mode: "one_per_page" as const }
                : { mode: "every_n" as const, n: Math.max(1, splitEveryN) };
        const outDir = outputDir || undefined;
        let total = 0;
        try {
            for (const f of files) {
                const paths = await invoke<string[]>("split_pdf", {
                    sourcePath: f.path,
                    outputDir: outDir ?? null,
                    mode,
                });
                total += paths.length;
            }
            setStatus({
                type: "success",
                text: `Created ${total} file${total !== 1 ? "s" : ""}.`,
            });
            onSplitComplete();
            setSplitPreviews([]);
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    }, [files, splitMode, splitEveryN, outputDir, setStatus, onSplitComplete]);

    const pickOutputFolder = useCallback(async () => {
        const selected = await open({
            multiple: false,
            directory: true,
        });
        if (selected !== null) setOutputDir(Array.isArray(selected) ? selected[0] : selected);
    }, []);

    const canSplit = files.length > 0 && splitPreviews.some((p) => p.parts.length > 0);

    const handleInternalReset = () => {
        setSplitPreviews([]);
        setOutputDir(null);
        onReset();
    };

    return (
        <>
            <div className="tool-header">
                <h2 className="tool-title">PDF Splitter</h2>
            </div>

            <section className="section" aria-labelledby="split-drop-label">
                <span id="split-drop-label" className="label">PDFs</span>
                <div
                    className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={onPickFiles}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onPickFiles();
                        }
                    }}
                    aria-label="Drop files or folder here, or click to select"
                >
                    <p className="primary">Drop files or folder here</p>
                    <p>or click to select files</p>
                    <p className="hint" style={{ marginTop: 8 }}>
                        <button type="button" className="btn btn-secondary" style={{ marginRight: 8 }} onClick={(e) => { e.stopPropagation(); onPickFiles(); }}>
                            Select files
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); onPickFolder(); }}>
                            Select folder
                        </button>
                    </p>
                    <p className="hint" style={{ marginTop: 6 }}>Only PDFs will be used.</p>
                </div>
            </section>

            {files.length > 0 && (
                <>
                    <section className="section">
                        <span className="label">{files.length} PDF{files.length !== 1 ? "s" : ""} selected</span>
                        <ul className="file-list" aria-label="PDF list">
                            {files.map((f, i) => (
                                <li key={`${f.path}-${i}`}>{f.name}</li>
                            ))}
                        </ul>
                    </section>

                    <section className="section">
                        <span className="label">Split mode</span>
                        <div className="radio-group">
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="splitMode"
                                    checked={splitMode === "every_n"}
                                    onChange={() => setSplitMode("every_n")}
                                />
                                Split every
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={splitEveryN}
                                onChange={(e) => setSplitEveryN(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                onKeyDown={(e) => {
                                    if (
                                        ["Backspace", "Delete", "Tab", "Escape", "Enter"].includes(e.key) ||
                                        ((e.ctrlKey || e.metaKey) && e.key === "a") ||
                                        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
                                    ) {
                                        return;
                                    }
                                    if (!/^[0-9]$/.test(e.key)) {
                                        e.preventDefault();
                                    }
                                }}
                                className="input"
                                style={{ width: 64 }}
                                disabled={splitMode === "one_per_page"}
                            />
                            <span>pages</span>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="splitMode"
                                    checked={splitMode === "one_per_page"}
                                    onChange={() => setSplitMode("one_per_page")}
                                />
                                One file per page
                            </label>
                        </div>
                    </section>

                    <section className="section">
                        <span className="label">Output folder</span>
                        <div className="radio-group">
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="outputFolder"
                                    checked={outputDir === null}
                                    onChange={() => setOutputDir(null)}
                                />
                                Same folder as each PDF (default)
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="outputFolder"
                                    checked={outputDir !== null}
                                    onChange={() => { }}
                                />
                                <button type="button" className="btn btn-secondary" onClick={pickOutputFolder}>
                                    Choose folder
                                </button>
                            </label>
                            {outputDir !== null && (
                                <span className="hint" style={{ flex: "1 1 100%" }}>{outputDir}</span>
                            )}
                        </div>
                    </section>

                    {splitPreviews.length > 0 && (
                        <section className="section">
                            <div className="preview-box">
                                <span className="label">Preview — files to create</span>
                                {splitPreviews.map((preview, idx) => (
                                    <div key={idx} style={{ marginTop: idx > 0 ? 12 : 0 }}>
                                        <strong>{preview.source_name}</strong> {preview.error ? (
                                            <div style={{ color: 'var(--error)', marginLeft: 8, marginTop: 4 }}>
                                                ⚠️ {preview.error}
                                                {preview.error.includes("invalid file trailer") && (
                                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginTop: 8, background: 'var(--bg-secondary)', padding: 8, borderRadius: 4, fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                                                        <strong>Diagnostic Data (Please copy/paste this):</strong>
                                                        <br /><br />
                                                        {preview.debug_info}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>({preview.page_count} pages) → {preview.parts.length} file{preview.parts.length !== 1 ? "s" : ""}</>
                                        )}
                                        {!preview.error && (
                                            <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                                                {preview.parts.slice(0, 10).map((p, i) => (
                                                    <li key={i}>{p.output_name} (pages {p.page_range})</li>
                                                ))}
                                                {preview.parts.length > 10 && (
                                                    <li>… and {preview.parts.length - 10} more</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <div className="actions">
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!canSplit}
                            onClick={handleSplit}
                            aria-label="Split PDFs"
                        >
                            Split {files.length} PDF{files.length !== 1 ? "s" : ""}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleInternalReset}
                        >
                            Reset
                        </button>
                    </div>
                </>
            )}

            {status && (
                <div className={`status ${status.type}`} role="status">
                    {status.text.split("\n").map((line, i) => (
                        <span key={i}>{line}{i < status.text.split("\n").length - 1 ? <br /> : null}</span>
                    ))}
                </div>
            )}
        </>
    );
}
