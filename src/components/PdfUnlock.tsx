import { useState, useCallback } from "react";
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
    const [password, setPassword] = useState("");

    const activeFile = files.length > 0 ? files[0] : null;

    const handleUnlock = useCallback(async () => {
        if (!activeFile) {
            setStatus({ type: "error", text: "Please select a PDF file." });
            return;
        }

        if (!password) {
            setStatus({ type: "error", text: "Please enter the password." });
            return;
        }

        try {
            const outputPath = await save({
                filters: [{ name: "PDF Document", extensions: ["pdf"] }],
                defaultPath: activeFile.name.replace(".pdf", "_unlocked.pdf"),
            });

            if (!outputPath) return;

            setStatus({ type: "info", text: "Unlocking PDF..." });

            await invoke("unlock_pdf", {
                path: activeFile.path,
                password,
                outputPath,
            });

            setStatus({
                type: "success",
                text: `Successfully unlocked:\n${outputPath}`,
            });
            setPassword("");
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    }, [activeFile, password, setStatus]);

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
                            <p className="primary">Drop a password-protected PDF here</p>
                            <p>or click to select</p>
                        </>
                    )}
                </div>
            </section>

            {activeFile && (
                <section className="section">
                    <label htmlFor="unlock-password" className="label">
                        Password
                    </label>
                    <input
                        id="unlock-password"
                        type="password"
                        className="input"
                        placeholder="Enter PDF password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleUnlock();
                        }}
                    />
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
                            disabled={!password}
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
