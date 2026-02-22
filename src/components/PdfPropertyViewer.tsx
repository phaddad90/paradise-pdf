import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileEntry, PdfProperties } from "../types";

interface Props {
    files: FileEntry[];
    onPickFiles: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onReset: () => void;
}

export function PdfPropertyViewer({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
}: Props) {
    const [properties, setProperties] = useState<{ [path: string]: PdfProperties }>({});
    const [loading, setLoading] = useState<{ [path: string]: boolean }>({});
    const [error, setError] = useState<string | null>(null);
    const [unit, setUnit] = useState<"mm" | "pts" | "in">("mm");

    useEffect(() => {
        const fetchProps = async () => {
            for (const file of files) {
                if (!properties[file.path] && !loading[file.path]) {
                    setLoading(prev => ({ ...prev, [file.path]: true }));
                    try {
                        const props = await invoke<PdfProperties>("get_pdf_properties", { path: file.path });
                        setProperties(prev => ({ ...prev, [file.path]: props }));
                    } catch (err) {
                        if (import.meta.env.DEV) console.error(err);
                        setError(String(err));
                    } finally {
                        setLoading(prev => ({ ...prev, [file.path]: false }));
                    }
                }
            }
        };
        fetchProps();
    }, [files]);

    const formatDimension = (pts: number) => {
        switch (unit) {
            case "mm": return `${(pts * 0.352778).toFixed(1)} mm`;
            case "in": return `${(pts / 72).toFixed(2)} in`;
            default: return `${pts.toFixed(1)} pts`;
        }
    };

    return (
        <div className="tool-container property-viewer">
            <div className="tool-header">
                <div className="title-group">
                    <h2 className="tool-title">Property Viewer</h2>
                    <div className="unit-selector">
                        <button className={unit === "mm" ? "active" : ""} onClick={() => setUnit("mm")}>mm</button>
                        <button className={unit === "pts" ? "active" : ""} onClick={() => setUnit("pts")}>pts</button>
                        <button className={unit === "in" ? "active" : ""} onClick={() => setUnit("in")}>in</button>
                    </div>
                </div>
                <div className="header-actions">
                    {files.length > 0 && <button className="btn btn-secondary" onClick={onReset}>Reset</button>}
                </div>
            </div>

            <section className="section drop-area">
                <div
                    className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={onPickFiles}
                >
                    {files.length > 0 ? (
                        <div className="file-grid">
                            {files.map(file => (
                                <div key={file.path} className="property-card">
                                    <div className="card-header">
                                        <span className="file-name">{file.name}</span>
                                        {loading[file.path] && <span className="loading-spinner">...</span>}
                                    </div>

                                    {properties[file.path] && (
                                        <div className="card-content">
                                            <div className="prop-group">
                                                <label>General</label>
                                                <div className="prop-row"><span>Pages:</span> <span>{properties[file.path].page_count}</span></div>
                                                <div className="prop-row"><span>Page Size:</span> <span>{formatDimension(properties[file.path].page_width)} × {formatDimension(properties[file.path].page_height)}</span></div>
                                                <div className="prop-row"><span>Colorspace:</span> <span className="colorspace-tag">{properties[file.path].colorspace}</span></div>
                                                <div className="prop-row"><span>Doc PPI:</span> <span>{properties[file.path].doc_dpi}</span></div>
                                                <div className="prop-row"><span>Version:</span> <span>PDF {properties[file.path].version}</span></div>
                                                <div className="prop-row"><span>Security:</span> <span>{properties[file.path].encrypted ? "🔒 Encrypted" : "🔓 None"}</span></div>
                                            </div>

                                            <div className="prop-group">
                                                <label>Metadata</label>
                                                {properties[file.path].producer && <div className="prop-row"><span>Producer:</span> <span>{properties[file.path].producer}</span></div>}
                                                {properties[file.path].creator && <div className="prop-row"><span>Creator:</span> <span>{properties[file.path].creator}</span></div>}
                                                {properties[file.path].created && <div className="prop-row"><span>Created:</span> <span>{properties[file.path].created}</span></div>}
                                                {Object.entries(properties[file.path].metadata).map(([key, val]) => (
                                                    <div key={key} className="prop-row"><span>{key}:</span> <span>{val}</span></div>
                                                ))}
                                            </div>

                                            {properties[file.path].image_dpi.length > 0 && (
                                                <div className="prop-group">
                                                    <label>Images ({properties[file.path].image_dpi.length})</label>
                                                    <div className="prop-row">
                                                        <span>Effective PPI:</span>
                                                        <span className="dpi-list">
                                                            {Array.from(new Set(properties[file.path].image_dpi)).slice(0, 5).join(", ")}
                                                            {new Set(properties[file.path].image_dpi).size > 5 && " ..."}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {properties[file.path].fonts.length > 0 && (
                                                <div className="prop-group">
                                                    <label>Fonts ({properties[file.path].fonts.length})</label>
                                                    <div className="font-list">
                                                        {properties[file.path].fonts.slice(0, 10).map(font => (
                                                            <div key={font} className="font-item">{font.replace(/^\/.*?\+/, '')}</div>
                                                        ))}
                                                        {properties[file.path].fonts.length > 10 && <div className="font-item">... and {properties[file.path].fonts.length - 10} more</div>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <p className="primary">Drop PDFs here to view properties</p>
                            <p>or click to select</p>
                        </>
                    )}
                </div>
            </section>

            {error && <div className="status error">{error}</div>}

            <style>{`
        .property-viewer .tool-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .title-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .unit-selector {
          display: flex;
          background: var(--bg-subtle);
          padding: 3px;
          border-radius: 8px;
          border: 1px solid var(--border);
        }

        .unit-selector button {
          padding: 4px 12px;
          border: none;
          background: none;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .unit-selector button.active {
          background: var(--surface);
          color: var(--primary);
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .colorspace-tag {
          background: var(--primary-subtle);
          color: var(--primary);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600 !important;
          font-size: 11px;
        }

        .file-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          width: 100%;
          text-align: left;
        }

        .property-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          max-height: 400px;
          overflow-y: auto;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }

        .file-name {
          font-weight: 600;
          color: var(--primary);
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .prop-group {
          margin-bottom: 12px;
        }

        .prop-group label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          margin-bottom: 6px;
          font-weight: 700;
        }

        .prop-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .prop-row span:first-child {
          color: var(--text-secondary);
        }

        .prop-row span:last-child {
          font-weight: 500;
          text-align: right;
          word-break: break-all;
          margin-left: 8px;
        }

        .font-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .font-item {
          background: var(--bg-subtle);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          color: var(--text);
          border: 1px solid var(--border);
        }

        .loading-spinner {
          font-size: 12px;
          color: var(--primary);
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}
