import React, { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const LOGO_SVG = (
  <svg className="app-logo" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="45%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#fb923c" />
      </linearGradient>
      <filter id="logo-shadow">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
      </filter>
    </defs>
    {/* Outer shell – matches icon style */}
    <rect x="6" y="6" width="108" height="108" rx="26" fill="#374151" opacity="0.12" />
    <rect x="14" y="14" width="92" height="92" rx="22" fill="url(#logo-grad)" filter="url(#logo-shadow)" />
    <path d="M44 36 L44 84 L88 84 L88 52 L72 36 L44 36 Z M72 36 L72 52 L88 52 L72 36 Z" fill="white" fillOpacity="0.95" />
    <line x1="50" y1="58" x2="82" y2="58" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    <line x1="50" y1="66" x2="78" y2="66" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    <line x1="50" y1="74" x2="80" y2="74" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
  </svg>
);

interface FileEntry {
  path: string;
  name: string;
}

interface PreviewResult {
  preview_names: string[];
  placeholder_found: boolean;
  overwrite_warnings: string[];
}

interface RenameResult {
  renamed: number;
  failed: { path: string; error: string }[];
}

interface SplitPreviewItem {
  output_name: string;
  page_range: string;
}

interface SplitPreviewResult {
  source_name: string;
  page_count: number;
  parts: SplitPreviewItem[];
}

const ORDER_NOTE = "Files are renamed in alphabetical order by filename.";

type ToolId = "pdf-bulk-renaming" | "pdf-splitter";

function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function App() {
  const [template, setTemplate] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolId>("pdf-bulk-renaming");
  const [splitMode, setSplitMode] = useState<"every_n" | "one_per_page">("every_n");
  const [splitEveryN, setSplitEveryN] = useState(5);
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [splitPreviews, setSplitPreviews] = useState<SplitPreviewResult[]>([]);
  const toolsRef = useRef<HTMLDivElement>(null);
  const toolsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pdfFiles = files.filter((f) => isPdf(f.name));

  const scheduleToolsClose = useCallback(() => {
    if (toolsCloseTimerRef.current) clearTimeout(toolsCloseTimerRef.current);
    toolsCloseTimerRef.current = setTimeout(() => setToolsOpen(false), 150);
  }, []);

  const cancelToolsClose = useCallback(() => {
    if (toolsCloseTimerRef.current) {
      clearTimeout(toolsCloseTimerRef.current);
      toolsCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pickOutputFolder = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: true,
    });
    if (selected !== null) setOutputDir(Array.isArray(selected) ? selected[0] : selected);
  }, []);

  const loadPaths = useCallback(async (paths: string[] | null) => {
    if (!paths || paths.length === 0) return;
    try {
      const entries = await invoke<FileEntry[]>("list_files_from_paths", { paths });
      setFiles(entries);
      setStatus(null);
      setPreview(null);
    } catch (e) {
      setStatus({ type: "error", text: String(e) });
      setFiles([]);
    }
  }, []);

  const pickFiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      directory: false,
    });
    if (selected === null) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await loadPaths(paths);
  }, [loadPaths]);

  const pickFolder = useCallback(async () => {
    const selected = await open({
      multiple: false,
      directory: true,
    });
    if (selected === null) return;
    await loadPaths([selected]);
  }, [loadPaths]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
      listen<{ paths?: string[] }>("tauri://drag-drop", (event) => {
        const paths = event.payload?.paths;
        if (paths && paths.length > 0) loadPaths(paths);
      }).then((fn) => { unlisten = fn; }).catch(() => {});
    }
    return () => { unlisten?.(); };
  }, [loadPaths]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

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

  React.useEffect(() => {
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
        setFiles([]);
        setPreview(null);
      }
    } catch (e) {
      setStatus({ type: "error", text: String(e) });
    }
  }, [canRename, hasOverwriteWarning, files, template]);

  const handleReset = useCallback(() => {
    setTemplate("");
    setFiles([]);
    setPreview(null);
    setStatus(null);
  }, []);

  useEffect(() => {
    if (currentTool !== "pdf-splitter" || pdfFiles.length === 0) {
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
      for (const f of pdfFiles) {
        if (cancelled) return;
        try {
          const r = await invoke<SplitPreviewResult>("split_pdf_preview", {
            path: f.path,
            mode,
          });
          results.push(r);
        } catch {
          results.push({
            source_name: f.name,
            page_count: 0,
            parts: [],
          });
        }
      }
      if (!cancelled) setSplitPreviews(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTool, pdfFiles, splitMode, splitEveryN]);

  const handleSplit = useCallback(async () => {
    if (pdfFiles.length === 0) return;
    setStatus(null);
    const mode =
      splitMode === "one_per_page"
        ? { mode: "one_per_page" as const }
        : { mode: "every_n" as const, n: Math.max(1, splitEveryN) };
    const outDir = outputDir || undefined;
    let total = 0;
    try {
      for (const f of pdfFiles) {
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
      setFiles([]);
      setSplitPreviews([]);
    } catch (e) {
      setStatus({ type: "error", text: String(e) });
    }
  }, [pdfFiles, splitMode, splitEveryN, outputDir]);

  const canSplit = pdfFiles.length > 0 && splitPreviews.some((p) => p.parts.length > 0);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          {LOGO_SVG}
          <span className="app-brand-name">Paradise PDF</span>
        </div>
        <div
          className="tools-menu-wrap"
          ref={toolsRef}
          onMouseEnter={() => { cancelToolsClose(); setToolsOpen(true); }}
          onMouseLeave={scheduleToolsClose}
        >
          <button
            type="button"
            className="tools-trigger"
            aria-expanded={toolsOpen}
            aria-haspopup="true"
            onClick={() => setToolsOpen((o) => !o)}
          >
            Tools
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {toolsOpen && (
            <ul className="tools-dropdown" role="menu">
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-bulk-renaming" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-bulk-renaming");
                    setToolsOpen(false);
                  }}
                >
                  PDF Bulk Renaming
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-splitter" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-splitter");
                    setToolsOpen(false);
                  }}
                >
                  PDF Splitter
                </button>
              </li>
            </ul>
          )}
        </div>
      </header>

      <main className="app-body">
        {currentTool === "pdf-bulk-renaming" && (
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
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={pickFiles}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pickFiles();
            }
          }}
          aria-label="Drop files or folder here, or click to select"
        >
          <p className="primary">Drop files or folder here</p>
          <p>or click to select files</p>
          <p className="hint" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" style={{ marginRight: 8 }} onClick={(e) => { e.stopPropagation(); pickFiles(); }}>
              Select files
            </button>
            <button type="button" className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); pickFolder(); }}>
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
        <button type="button" className="btn btn-secondary" onClick={handleReset}>
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
        )}

        {currentTool === "pdf-splitter" && (
          <>
            <h2 className="tool-title">PDF Splitter</h2>

            <section className="section" aria-labelledby="split-drop-label">
              <span id="split-drop-label" className="label">PDFs</span>
              <div
                className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={pickFiles}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pickFiles();
                  }
                }}
                aria-label="Drop files or folder here, or click to select"
              >
                <p className="primary">Drop files or folder here</p>
                <p>or click to select files</p>
                <p className="hint" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" style={{ marginRight: 8 }} onClick={(e) => { e.stopPropagation(); pickFiles(); }}>
                    Select files
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); pickFolder(); }}>
                    Select folder
                  </button>
                </p>
                <p className="hint" style={{ marginTop: 6 }}>Only PDFs will be used.</p>
              </div>
            </section>

            {pdfFiles.length > 0 && (
              <>
                <section className="section">
                  <span className="label">{pdfFiles.length} PDF{pdfFiles.length !== 1 ? "s" : ""} selected</span>
                  <ul className="file-list" aria-label="PDF list">
                    {pdfFiles.map((f, i) => (
                      <li key={`${f.path}-${i}`}>{f.name}</li>
                    ))}
                  </ul>
                </section>

                <section className="section">
                  <span className="label">Split mode</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                      className="input"
                      style={{ width: 64 }}
                      disabled={splitMode === "one_per_page"}
                    />
                    <span>pages</span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="radio"
                        name="outputFolder"
                        checked={outputDir === null}
                        onChange={() => setOutputDir(null)}
                      />
                      Same folder as each PDF (default)
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="radio"
                        name="outputFolder"
                        checked={outputDir !== null}
                        onChange={() => {}}
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
                          <strong>{preview.source_name}</strong> ({preview.page_count} pages) → {preview.parts.length} file{preview.parts.length !== 1 ? "s" : ""}
                          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                            {preview.parts.slice(0, 10).map((p, i) => (
                              <li key={i}>{p.output_name} (pages {p.page_range})</li>
                            ))}
                            {preview.parts.length > 10 && (
                              <li>… and {preview.parts.length - 10} more</li>
                            )}
                          </ul>
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
                    Split {pdfFiles.length} PDF{pdfFiles.length !== 1 ? "s" : ""}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setFiles([]);
                      setSplitPreviews([]);
                      setOutputDir(null);
                      setStatus(null);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </>
            )}

            {currentTool === "pdf-splitter" && status && (
              <div className={`status ${status.type}`} role="status">
                {status.text.split("\n").map((line, i) => (
                  <span key={i}>{line}{i < status.text.split("\n").length - 1 ? <br /> : null}</span>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
