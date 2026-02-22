import React, { useCallback, useEffect, useRef, useState } from "react";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { FileEntry } from "./types";
import { Logo } from "./components/Logo";
import { BulkRenamer } from "./components/BulkRenamer";
import { PdfSplitter } from "./components/PdfSplitter";
import { PdfMerger } from "./components/PdfMerger";
import { PageBoxInspector } from "./components/PageBoxInspector";
import { PdfRotator } from "./components/PdfRotator";
import PdfOrganiser from "./components/PdfOrganiser";
import { PdfMixer } from "./components/PdfMixer";
import { PdfProtect } from "./components/PdfProtect";
import { PdfPropertyViewer } from "./components/PdfPropertyViewer";

type ToolId = "pdf-bulk-renaming" | "pdf-splitter" | "pdf-merger" | "page-box-inspector" | "pdf-rotator" | "pdf-organiser" | "pdf-mixer" | "pdf-protect" | "pdf-property-viewer";

const VALID_TOOLS: ToolId[] = ["pdf-bulk-renaming", "pdf-splitter", "pdf-merger", "page-box-inspector", "pdf-rotator", "pdf-organiser", "pdf-mixer", "pdf-protect", "pdf-property-viewer"];

function isPdf(name: string): boolean {
  return name.toLowerCase().endsWith(".pdf");
}

function App() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [currentTool, setCurrentTool] = useState<ToolId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lastActiveTool");
      if (saved && (VALID_TOOLS as string[]).includes(saved)) return saved as ToolId;
    }
    return "pdf-bulk-renaming";
  });

  const checkForUpdates = useCallback(async (manual = false) => {
    try {
      const update = await check();
      if (update?.available) {
        const yes = await ask(`Update to ${update.version} is available!\n\n${update.body}`, {
          title: 'Update Available',
          kind: 'info',
          okLabel: 'Update',
          cancelLabel: 'Cancel'
        });
        if (yes) {
          await update.downloadAndInstall();
          await relaunch();
        }
      } else if (manual) {
        await ask('You are already running the latest version of Paradise PDF.', {
          title: 'Up to Date',
          kind: 'info',
          okLabel: 'OK'
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to check for updates:', error);
      if (manual) {
        await ask(`Failed to check for updates: ${error}`, {
          title: 'Update Check Failed',
          kind: 'error',
          okLabel: 'OK'
        });
      }
    }
  }, []);

  useEffect(() => {
    checkForUpdates();
    const unlisten = listen("check-for-updates", () => checkForUpdates(true));
    return () => {
      unlisten.then(f => f());
    };
  }, [checkForUpdates]);

  useEffect(() => {
    localStorage.setItem("lastActiveTool", currentTool);
  }, [currentTool]);

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

  const loadPaths = useCallback(async (paths: string[] | null) => {
    if (!paths || paths.length === 0) return;
    try {
      const entries = await invoke<FileEntry[]>("list_files_from_paths", { paths });

      setFiles((prev) => {
        const shouldAppend = currentTool === "pdf-merger" || currentTool === "pdf-bulk-renaming" || currentTool === "pdf-mixer";

        if (shouldAppend) {
          const newFiles = [...prev];
          for (const entry of entries) {
            if (!newFiles.some(f => f.path === entry.path)) {
              newFiles.push(entry);
            }
          }
          return newFiles;
        } else {
          return entries;
        }
      });

      setStatus(null);
    } catch (e) {
      setStatus({ type: "error", text: String(e) });
      if (currentTool !== "pdf-merger" && currentTool !== "pdf-bulk-renaming" && currentTool !== "pdf-mixer") {
        setFiles([]);
      }
    }
  }, [currentTool]);

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
      }).then((fn) => { unlisten = fn; }).catch(() => { });
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

  const handleReset = useCallback(() => {
    setFiles([]);
    setStatus(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <Logo />
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
            aria-label="Toggle tools menu"
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
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-merger" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-merger");
                    setToolsOpen(false);
                  }}
                >
                  PDF Merger
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "page-box-inspector" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("page-box-inspector");
                    setToolsOpen(false);
                  }}
                >
                  Page Box Inspector
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-rotator" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-rotator");
                    setToolsOpen(false);
                  }}
                >
                  Rotate Pages
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-organiser" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-organiser");
                    setToolsOpen(false);
                  }}
                >
                  Organise PDF
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-mixer" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-mixer");
                    setToolsOpen(false);
                  }}
                >
                  Alternate & Mix
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-property-viewer" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-property-viewer");
                    setToolsOpen(false);
                  }}
                >
                  Property Viewer
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={currentTool === "pdf-protect" ? "active" : ""}
                  onClick={() => {
                    setCurrentTool("pdf-protect");
                    setToolsOpen(false);
                  }}
                >
                  Protect PDF
                </button>
              </li>
            </ul>
          )}
        </div>
      </header>

      <main className="app-body">
        {currentTool === "pdf-bulk-renaming" && (
          <BulkRenamer
            files={files}
            onPickFiles={pickFiles}
            onPickFolder={pickFolder}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onRenameComplete={handleReset}
            setStatus={setStatus}
            status={status}
            onReset={handleReset}
          />
        )}

        {currentTool === "pdf-splitter" && (
          <PdfSplitter
            files={pdfFiles}
            onPickFiles={pickFiles}
            onPickFolder={pickFolder}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
            setStatus={setStatus}
            status={status}
            onSplitComplete={handleReset}
          />
        )}

        {currentTool === "pdf-merger" && (
          <PdfMerger
            files={files}
            setFiles={setFiles}
            onPickFiles={pickFiles}
            onPickFolder={pickFolder}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
            setStatus={setStatus}
            status={status}
            onMergeComplete={handleReset}
          />
        )}

        {currentTool === "page-box-inspector" && (
          <PageBoxInspector
            files={files}
            onPickFiles={pickFiles}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
          />
        )}

        {currentTool === "pdf-rotator" && (
          <PdfRotator
            files={files}
            onPickFiles={pickFiles}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
            setStatus={setStatus}
            status={status}
          />
        )}

        {currentTool === "pdf-organiser" && (
          <PdfOrganiser
            files={files}
            onPickFiles={pickFiles}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
            setStatus={setStatus}
          />
        )}

        {currentTool === "pdf-mixer" && (
          <PdfMixer
            files={files}
            setFiles={setFiles}
            onPickFiles={pickFiles}
            onPickFolder={pickFolder}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
            setStatus={setStatus}
            status={status}
            onMixComplete={handleReset}
          />
        )}


        {currentTool === "pdf-protect" && (
          <PdfProtect
            files={files}
            onPickFiles={pickFiles}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
            setStatus={setStatus}
            status={status}
          />
        )}

        {currentTool === "pdf-property-viewer" && (
          <PdfPropertyViewer
            files={pdfFiles}
            onPickFiles={pickFiles}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            dragOver={dragOver}
            onReset={handleReset}
          />
        )}

      </main>
    </div>
  );
}

export default App;
