import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { FileEntry, StatusMessage } from "../types";

interface PdfProtectProps {
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

export function PdfProtect({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
    setStatus,
    status,
}: PdfProtectProps) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const activeFile = files.length > 0 ? files[0] : null;

    const handleProtect = useCallback(async () => {
        if (!activeFile) {
            setStatus({ type: "error", text: "Please select a PDF file." });
            return;
        }

        if (!password) {
            setStatus({ type: "error", text: "Please enter a password." });
            return;
        }

        if (password !== confirmPassword) {
            setStatus({ type: "error", text: "Passwords do not match." });
            return;
        }

        try {
            const outputPath = await save({
                filters: [{ name: "PDF Document", extensions: ["pdf"] }],
                defaultPath: activeFile.name.replace(".pdf", "_protected.pdf"),
            });

            if (!outputPath) return;

            setStatus({ type: "info", text: "Protecting PDF..." });

            await invoke("protect_pdf", {
                path: activeFile.path,
                userPassword: password,
                ownerPassword: null,
                outputPath,
            });

            setStatus({
                type: "success",
                text: `Successfully protected:\n${outputPath}`,
            });
            setPassword("");
            setConfirmPassword("");
        } catch (e) {
            setStatus({ type: "error", text: String(e) });
        }
    }, [activeFile, password, confirmPassword, setStatus]);

    const passwordsMatch = password === confirmPassword;
    const canProtect = password && confirmPassword && passwordsMatch;

    return (
        <>
            <h2 className="tool-header">Protect PDF</h2>

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
                            <p className="primary">Drop a PDF here to protect</p>
                            <p>or click to select</p>
                        </>
                    )}
                </div>
            </section>

            {activeFile && (
                <section className="section">
                    <label htmlFor="protect-password" className="label">
                        New Password
                    </label>
                    <input
                        id="protect-password"
                        type="password"
                        className="input"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <label
                        htmlFor="confirm-password"
                        className="label"
                        style={{ marginTop: 12 }}
                    >
                        Confirm Password
                    </label>
                    <input
                        id="confirm-password"
                        type="password"
                        className="input"
                        placeholder="Confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && canProtect) handleProtect();
                        }}
                    />

                    {confirmPassword && !passwordsMatch && (
                        <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: 4 }}>
                            Passwords do not match
                        </p>
                    )}
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
                            onClick={handleProtect}
                            disabled={!canProtect}
                        >
                            Protect PDF
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
