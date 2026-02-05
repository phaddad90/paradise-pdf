import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileEntry, PageBoxes } from "../types";

interface PageBoxInspectorProps {
    files: FileEntry[];
    onPickFiles: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onReset: () => void;
}

type Unit = "pt" | "mm" | "in" | "px";

const UNITS: { value: Unit; label: string }[] = [
    { value: "pt", label: "Points (pt)" },
    { value: "mm", label: "Millimeters (mm)" },
    { value: "in", label: "Inches (in)" },
    { value: "px", label: "Pixels (96 DPI)" },
];

export function PageBoxInspector({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
}: PageBoxInspectorProps) {
    const [boxData, setBoxData] = useState<PageBoxes[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedUnit, setSelectedUnit] = useState<Unit>("mm");

    // Only take the first file
    const activeFile = files.length > 0 ? files[0] : null;

    useEffect(() => {
        if (!activeFile) {
            setBoxData(null);
            return;
        }

        const loadBoxes = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await invoke<PageBoxes[]>("get_page_boxes", { path: activeFile.path });
                setBoxData(data);
            } catch (e) {
                setError(String(e));
                setBoxData(null);
            } finally {
                setLoading(false);
            }
        };

        loadBoxes();
    }, [activeFile]);

    const convertValue = (val: number, unit: Unit): number => {
        // 1 PDF point = 1/72 inch
        switch (unit) {
            case "pt": return val;
            case "mm": return (val / 72) * 25.4;
            case "in": return val / 72;
            case "px": return (val / 72) * 96;
            default: return val;
        }
    };

    const formatBoxString = (boxStr: string | null, unit: Unit): string => {
        if (!boxStr) return "-";
        try {
            const parts = JSON.parse(boxStr) as number[];
            if (Array.isArray(parts) && parts.length === 4) {
                // PDF Spec: [Left, Bottom, Right, Top]. 
                // We want Width x Height.
                const width = Math.abs(parts[2] - parts[0]);
                const height = Math.abs(parts[3] - parts[1]);

                const cW = convertValue(width, unit);
                const cH = convertValue(height, unit);

                return `${cW.toFixed(2)} x ${cH.toFixed(2)}`;
            }
        } catch (e) {
            // ignore
        }
        return boxStr;
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="tool-title" style={{ margin: 0 }}>Page Box Inspector</h2>
                {activeFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label htmlFor="unit-select" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Units:</label>
                        <select
                            id="unit-select"
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value as Unit)}
                            className="input"
                            style={{ width: 'auto', padding: '4px 8px' }}
                        >
                            {UNITS.map(u => (
                                <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                        </select>
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
                >
                    {activeFile ? (
                        <p className="primary">Inspecting: <strong>{activeFile.name}</strong></p>
                    ) : (
                        <>
                            <p className="primary">Drop a PDF here to inspect</p>
                            <p>or click to select</p>
                        </>
                    )}
                </div>
            </section>

            {loading && <div style={{ padding: 20, textAlign: 'center' }}>Loading page boxes...</div>}

            {error && (
                <div className="status error">
                    Error: {error}
                </div>
            )}

            {boxData && (
                <section className="section">
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Page</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>MediaBox (W x H)</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>CropBox (W x H)</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>TrimBox (W x H)</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>BleedBox (W x H)</th>
                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>ArtBox (W x H)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {boxData.map((page, idx) => (
                                    <tr key={page.page_number} style={{ borderBottom: idx < boxData.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                        <td style={{ padding: '12px 16px' }}>{page.page_number}</td>
                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{formatBoxString(page.media_box, selectedUnit)}</td>
                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{formatBoxString(page.crop_box, selectedUnit)}</td>
                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{formatBoxString(page.trim_box, selectedUnit)}</td>
                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{formatBoxString(page.bleed_box, selectedUnit)}</td>
                                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{formatBoxString(page.art_box, selectedUnit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeFile && (
                <div className="actions">
                    <button className="btn btn-secondary" onClick={onReset}>Close / Reset</button>
                </div>
            )}
        </>
    );
}
