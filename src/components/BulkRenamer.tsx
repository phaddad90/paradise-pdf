import React, { useCallback, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileEntry, PreviewResult, RenameResult } from "../types";

const ORDER_NOTE = "Files are renamed in alphabetical order by filename.";

interface BulkRenamerProps {
    files: FileEntry[];
    onPickFiles: () => void;
    onPickFolder: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onRenameComplete: () => void;
    setStatus: (status: { type: "success" | "error" | "info"; text: string } | null) => void;
    status: { type: "success" | "error" | "info"; text: string } | null;
    onReset: () => void;
}

export function BulkRenamer({
    files,
    onPickFiles,
    onPickFolder,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onRenameComplete,
    setStatus,
    status,
    onReset,
}: BulkRenamerProps) {
    const [template, setTemplate] = useState("");
    const [preview, setPreview] = useState<PreviewResult | null>(null);

    const updatePreview = useCallback(async () => {
        if (!template.trim() || files.length === 0) {
            setPreview(null);
            return;
        }
        try {
            const result = await invoke<PreviewResult>("validate_template", {
                template: template.trim(),
                fileEntries: files,
            });
            setPreview(result);
        } catch {
            setPreview(null);
        }
    }, [template, files]);

    useEffect(() => {
        const t = setTimeout(updatePreview, 300);
        return () => clearTimeout(t);
    }, [updatePreview]);

    const canRename = template.trim().length > 0 && preview?.placeholder_found && files.length > 0;
    const hasOverwriteWarning = preview && preview.overwrite_warnings.length > 0;

    const handleRename = useCallback(async () => {
        if (!canRename) return;
        if (hasOverwriteWarning) {
            const ok = window.confirm(
                "Some new names already exist and would overwrite files. Continue anyway?"
            );
            if (!ok) return;
        }
        setStatus(null);
        try {
            const result = await invoke<RenameResult>("batch_rename", {
                fileEntries: files,
                template: template.trim(),
            });
            if (result.failed.length > 0) {
                const msg = result.failed.map((f) => `${f.path}: ${f.error}`).join("\n");
                setStatus({
                    type: "error",
                    text: `Renamed ${result.renamed} files. Failures:\n${msg}`,
                });
            } else {
                setStatus({
                    type: "success",
                    text: `Successfully renamed ${result.renamed} file${result.renamed !== 1 ? "s" : ""}.`,
                });
                onRenameComplete();
                setPreview(null);
            }
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    }, [canRename, hasOverwriteWarning, files, template, setStatus, onRenameComplete]);

    const handleInternalReset = () => {
        setTemplate("");
        setPreview(null);
        onReset();
    };

    return (
        <>
            <h2 className="tool-title">PDF Bulk Renaming</h2>

            <section className="section" aria-labelledby="pattern-label">
                <label id="pattern-label" className="label" htmlFor="template">
                    Naming pattern
                </label>
                <input
                    id="template"
                    type="text"
                    className="input"
                    placeholder="e.g. 1033388-V##-SKU-PP-FLY-A5-350S-SIDES44"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    aria-describedby="pattern-hint"
                />
                <p id="pattern-hint" className="hint">
                    Use # for one digit, ## for two (01, 02), ### for three (001, 002), or {"{version}"} for two digits. Extension is kept from each file.
                </p>
            </section>

            <section className="section" aria-labelledby="drop-label">
                <span id="drop-label" className="label">Files</span>
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
                </div>
                <p className="hint" style={{ marginTop: 6 }}>{ORDER_NOTE}</p>
            </section>

            {files.length > 0 && (
                <>
                    <section className="section">
                        <span className="label">{files.length} file{files.length !== 1 ? "s" : ""} to rename</span>
                        <ul className="file-list" aria-label="File list in rename order">
                            {files.map((f, i) => (
                                <li key={`${f.path}-${i}`}>{f.name}</li>
                            ))}
                        </ul>
                    </section>

                    {preview?.placeholder_found && (
                        <section className="section">
                            <div className="preview-box">
                                <span className="label">Preview (first 3 names)</span>
                                <ul>
                                    {preview.preview_names.map((name, i) => (
                                        <li key={i}>{name}</li>
                                    ))}
                                </ul>
                            </div>
                        </section>
                    )}

                    {preview?.overwrite_warnings && preview.overwrite_warnings.length > 0 && (
                        <section className="section">
                            <div className="warning-box">
                                <strong>Warning:</strong> The following paths already exist and would be overwritten:
                                <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                                    {preview.overwrite_warnings.slice(0, 5).map((p, i) => (
                                        <li key={i}>{p}</li>
                                    ))}
                                    {preview.overwrite_warnings.length > 5 && (
                                        <li>… and {preview.overwrite_warnings.length - 5} more</li>
                                    )}
                                </ul>
                            </div>
                        </section>
                    )}
                </>
            )}

            <div className="actions">
                <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canRename}
                    onClick={handleRename}
                    aria-label={`Rename ${files.length} files`}
                >
                    Rename {files.length} file{files.length !== 1 ? "s" : ""}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleInternalReset}>
                    Reset
                </button>
            </div>

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
