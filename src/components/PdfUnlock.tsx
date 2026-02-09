import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { FileEntry, StatusMessage } from "../types";

interface PdfUnlockProps {
    files: FileEntry[];
    onPickFiles: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onReset: () => void;
    setStatus: (status: StatusMessage | null) => void;
    status: StatusMessage | null;
}

export function PdfUnlock({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
    setStatus,
    status,
}: PdfUnlockProps) {
    const activeFile = files.length > 0 ? files[0] : null;

    const handleUnlock = useCallback(async () => {
        if (!activeFile) {
            setStatus({ type: "error", text: "Please select a PDF file." });
            return;
        }

        try {
            const outputPath = await save({
                filters: [{ name: "PDF Document", extensions: ["pdf"] }],
                defaultPath: activeFile.name.replace(".pdf", "_unlocked.pdf"),
            });

            if (!outputPath) return;

            setStatus({ type: "info", text: "Removing restrictions..." });

            await invoke("unlock_pdf", {
                path: activeFile.path,
                outputPath,
            });

            setStatus({
                type: "success",
                text: `Successfully unlocked:\n${outputPath}`,
            });
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    }, [activeFile, setStatus]);

    return (
        <>
            <h2 className="tool-header">Unlock PDF</h2>

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
                        <p className="primary">
                            Selected: <strong>{activeFile.name}</strong>
                        </p>
                    ) : (
                        <>
                            <p className="primary">Drop a PDF here to unlock</p>
                            <p>or click to select</p>
                        </>
                    )}
                </div>
            </section>

            {activeFile && (
                <section className="section">
                    <p style={{ marginBottom: 16 }}>
                        Click below to remove encryption and owner restrictions (e.g., printing or copying bans).
                        <br />
                        <small style={{ opacity: 0.7 }}>
                            Note: This tool removes owner restrictions. If the file has a user password (required to open),
                            it attempts to remove it if empty, otherwise it may fail.
                        </small>
                    </p>
                </section>
            )}

            {status && (
                <div className={`status ${status.type}`}>
                    {status.text}
                </div>
            )}

            <div className="actions">
                {activeFile && (
                    <>
                        <button
                            className="btn btn-primary"
                            onClick={handleUnlock}
                        >
                            Unlock PDF
                        </button>
                        <button className="btn btn-secondary" onClick={onReset}>
                            Reset
                        </button>
                    </>
                )}
            </div>
        </>
    );
}
