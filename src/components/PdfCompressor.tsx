import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { FileEntry, CompressionSettings, CompressionResult } from "../types";

interface Props {
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

interface FileStats {
    originalSize: number;
    compressedSize?: number;
    savingPercent?: number;
    isCompressing: boolean;
    done: boolean;
}

type TabId = "images" | "fonts" | "metadata" | "structure";

export function PdfCompressor({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
    setStatus,
    status,
}: Props) {
    const [activeTab, setActiveTab] = useState<TabId>("images");
    const [fileStats, setFileStats] = useState<{ [path: string]: FileStats }>({});

    const [settings, setSettings] = useState<CompressionSettings>({
        image_quality: 80,
        max_resolution_dpi: 150,
        reduce_color_complexity: true,
        clip_invisible: true,
        force_recompression: false,
        remove_unused_fonts: true,
        convert_to_cff: true,
        merge_font_programs: true,
        remove_annotations: false,
        flatten_form_fields: false,
        remove_metadata: true,
        remove_thumbnails: true,
        remove_application_data: true,
        remove_structure_tree: true,
    });

    // Calculate stats when files change
    useEffect(() => {
        const newStats: { [path: string]: FileStats } = {};
        const checkSizes = async () => {
            for (const file of files) {
                // In a real app we'd fetch actual size from backend if not already provided
                // For now, we'll initialize
                newStats[file.path] = {
                    originalSize: 0,
                    isCompressing: false,
                    done: false
                };
            }
            setFileStats(newStats);
        };
        checkSizes();
    }, [files]);

    const handleCompressFile = async (file: FileEntry, saveAs: boolean) => {
        let outputPath = file.path;

        if (saveAs) {
            const selected = await save({
                defaultPath: file.path.replace(".pdf", "_compressed.pdf"),
                filters: [{ name: "PDF", extensions: ["pdf"] }],
            });
            if (!selected) return;
            outputPath = selected;
        } else {
            outputPath = file.path.replace(".pdf", "_tmp_compressed.pdf");
        }

        setFileStats(prev => ({
            ...prev,
            [file.path]: { ...prev[file.path], isCompressing: true }
        }));

        try {
            const result = await invoke<CompressionResult>("compress_pdf", {
                path: file.path,
                outputPath,
                settings,
            });

            if (result.success) {
                setFileStats(prev => ({
                    ...prev,
                    [file.path]: {
                        ...prev[file.path],
                        compressedSize: result.compressed_size,
                        originalSize: result.original_size,
                        savingPercent: Math.round((1 - (result.compressed_size / result.original_size)) * 100),
                        isCompressing: false,
                        done: true
                    }
                }));
                setStatus({ type: "success", text: "Compression complete!" });
            }
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
            setFileStats(prev => ({
                ...prev,
                [file.path]: { ...prev[file.path], isCompressing: false }
            }));
        }
    };

    const handleSaveAll = async () => {
        setStatus({ type: "info", text: "Compressing all files..." });
        for (const file of files) {
            await handleCompressFile(file, false);
        }
    };

    const formatSize = (bytes?: number) => {
        if (bytes === undefined) return "---";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case "images":
                return (
                    <div className="settings-grid">
                        <div className="setting-item">
                            <label>Image Quality: {settings.image_quality}%</label>
                            <input
                                type="range" min="10" max="100"
                                value={settings.image_quality}
                                onChange={e => setSettings({ ...settings, image_quality: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="setting-item">
                            <label>Max Resolution (DPI)</label>
                            <select
                                value={settings.max_resolution_dpi}
                                onChange={e => setSettings({ ...settings, max_resolution_dpi: parseInt(e.target.value) })}
                            >
                                <option value={72}>72 DPI (Web)</option>
                                <option value={150}>150 DPI (Standard)</option>
                                <option value={300}>300 DPI (Print)</option>
                            </select>
                        </div>
                        <div className="setting-item mt-12">
                            <label className="checkbox-label">
                                <input type="checkbox" checked={settings.reduce_color_complexity} onChange={e => setSettings({ ...settings, reduce_color_complexity: e.target.checked })} />
                                Reduce colour complexity of images
                            </label>
                            <label className="checkbox-label">
                                <input type="checkbox" checked={settings.clip_invisible} onChange={e => setSettings({ ...settings, clip_invisible: e.target.checked })} />
                                Clip invisible parts of images
                            </label>
                        </div>
                    </div>
                );
            case "fonts":
                return (
                    <div className="settings-grid">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.remove_unused_fonts} onChange={e => setSettings({ ...settings, remove_unused_fonts: e.target.checked })} />
                            Remove unused font glyphs (subsetting)
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.convert_to_cff} onChange={e => setSettings({ ...settings, convert_to_cff: e.target.checked })} />
                            Convert to Compact Font Format (CFF)
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.merge_font_programs} onChange={e => setSettings({ ...settings, merge_font_programs: e.target.checked })} />
                            Merge embedded font programs
                        </label>
                    </div>
                );
            case "metadata":
                return (
                    <div className="settings-grid">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.remove_metadata} onChange={e => setSettings({ ...settings, remove_metadata: e.target.checked })} />
                            Remove document metadata (Author, Producer, etc.)
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.remove_annotations} onChange={e => setSettings({ ...settings, remove_annotations: e.target.checked })} />
                            Remove annotations and comments
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.flatten_form_fields} onChange={e => setSettings({ ...settings, flatten_form_fields: e.target.checked })} />
                            Flatten form fields
                        </label>
                    </div>
                );
            case "structure":
                return (
                    <div className="settings-grid">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.remove_thumbnails} onChange={e => setSettings({ ...settings, remove_thumbnails: e.target.checked })} />
                            Remove page thumbnails
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.remove_structure_tree} onChange={e => setSettings({ ...settings, remove_structure_tree: e.target.checked })} />
                            Remove document structure tree
                        </label>
                        <label className="checkbox-label">
                            <input type="checkbox" checked={settings.remove_application_data} onChange={e => setSettings({ ...settings, remove_application_data: e.target.checked })} />
                            Remove private application data
                        </label>
                    </div>
                );
        }
    };

    return (
        <div className="tool-container compressor-tool">
            <div className="tool-header">
                <h2 className="tool-title">Compress PDF</h2>
                {files.length > 1 && (
                    <button className="btn btn-primary" onClick={handleSaveAll}>Save All</button>
                )}
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
                        <div className="file-list">
                            {files.map(file => {
                                const stats = fileStats[file.path];
                                return (
                                    <div key={file.path} className="compress-file-item">
                                        <div className="file-info">
                                            <span className="file-name">{file.name}</span>
                                            {stats?.done && (
                                                <div className="savings-badge">
                                                    {formatSize(stats.originalSize)} → {formatSize(stats.compressedSize)}
                                                    <span className="percent"> ({stats.savingPercent}% saved)</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="file-actions">
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                disabled={stats?.isCompressing}
                                                onClick={(e) => { e.stopPropagation(); handleCompressFile(file, true); }}
                                            >
                                                {stats?.isCompressing ? "..." : "Save As..."}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <>
                            <p className="primary">Drop PDFs here to compress</p>
                            <p>or click to select</p>
                        </>
                    )}
                </div>
            </section>

            {files.length > 0 && (
                <section className="section settings-section">
                    <div className="tabs-header">
                        <button className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`} onClick={() => setActiveTab('images')}>🖼️ Images</button>
                        <button className={`tab-btn ${activeTab === 'fonts' ? 'active' : ''}`} onClick={() => setActiveTab('fonts')}>Aa Fonts</button>
                        <button className={`tab-btn ${activeTab === 'metadata' ? 'active' : ''}`} onClick={() => setActiveTab('metadata')}>📑 Metadata</button>
                        <button className={`tab-btn ${activeTab === 'structure' ? 'active' : ''}`} onClick={() => setActiveTab('structure')}>⚙️ Structure</button>
                    </div>
                    <div className="tab-pane">
                        {renderTabContent()}
                    </div>
                </section>
            )}

            {status && (
                <div className={`status ${status.type}`} role="status">
                    {status.text}
                </div>
            )}

            <style>{`
        .compressor-tool .file-list {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .compress-file-item {
            background: var(--surface);
            padding: 12px 16px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid var(--border);
        }
        .savings-badge {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 4px;
        }
        .savings-badge .percent {
            color: var(--success);
            font-weight: bold;
        }
        .tabs-header {
            display: flex;
            gap: 4px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 16px;
        }
        .tab-btn {
            background: none;
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            color: var(--text-secondary);
            border-bottom: 2px solid transparent;
            font-size: 13px;
            transition: all 0.2s;
        }
        .tab-btn:hover {
            color: var(--text);
            background: var(--hover);
        }
        .tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
            font-weight: 500;
        }
        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            font-size: 13px;
            cursor: pointer;
        }
        .setting-item {
            margin-bottom: 16px;
        }
        .setting-item label {
            display: block;
            font-size: 13px;
            margin-bottom: 6px;
        }
        .mt-12 { margin-top: 12px; }
      `}</style>
        </div>
    );
}
