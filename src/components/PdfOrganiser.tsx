import { useState, useEffect, useRef } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { FileEntry, PageAction, PdfPage } from '../types';
import { PdfThumbnail } from './PdfThumbnail';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragOverlay,
    DragStartEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
    files: FileEntry[];
    onPickFiles: () => void;
    onDrop: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    dragOver: boolean;
    onReset: () => void;
    setStatus: (status: { type: 'success' | 'error' | 'info'; text: string } | null) => void;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    pageId: string | null;
    index: number;
}

// Sortable Item Component
function SortableItem({
    page,
    id,
    selected,
    onContextMenu,
    onClick,
    isOverlay = false,
    filePath
}: {
    page: PdfPage;
    id: string;
    selected: boolean;
    onContextMenu: (e: React.MouseEvent, pageId: string, index: number) => void;
    onClick: (e: React.MouseEvent, pageId: string, idx: number) => void;
    isOverlay?: boolean;
    filePath?: string;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        // Ensure context menu works by stopping propagation of long press on touch
        touchAction: 'none'
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`page-thumb ${selected ? 'selected' : ''} ${isOverlay ? 'dragging' : ''}`}
            onClick={(e) => onClick(e, id, page.page_number ? page.page_number - 1 : -1)}
            onContextMenu={(e) => onContextMenu(e, id, -1)}
        >
            <div className="thumb-content">
                {page.type === "blank" ? (
                    <div className="blank-page-indicator">Blank</div>
                ) : (
                    filePath && page.page_number ? (
                        <div className="page-img-container" style={{ width: '100%', height: '100%' }}>
                            <PdfThumbnail path={filePath} pageNumber={page.page_number} />
                        </div>
                    ) : (
                        <div className="page-placeholder">
                            <span>{page.page_number}</span>
                        </div>
                    )
                )}
                <div className="page-number">
                    {page.type === "existing" ? page.page_number : "Blank"}
                </div>
            </div>
        </div>
    );
}

export default function PdfOrganiser({
    files,
    onPickFiles,
    onDrop,
    onDragOver,
    onDragLeave,
    dragOver,
    onReset,
    setStatus
}: Props) {
    const [pages, setPages] = useState<PdfPage[]>([]);
    const [history, setHistory] = useState<PdfPage[][]>([]);
    const [future, setFuture] = useState<PdfPage[][]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null); // Anchor for Shift+Click
    const [activeId, setActiveId] = useState<string | null>(null);

    const addToHistory = (currentPages: PdfPage[]) => {
        setHistory(prev => [...prev, [...currentPages]]);
        setFuture([]); // Clear future when a new action is performed
    };

    const undo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        const newHistory = history.slice(0, history.length - 1);

        setFuture(prev => [...prev, [...pages]]);
        setPages(previous);
        setHistory(newHistory);
        setSelectedIds(new Set());
        setLastSelectedId(null);
    };

    const redo = () => {
        if (future.length === 0) return;
        const next = future[future.length - 1];
        const newFuture = future.slice(0, future.length - 1);

        setHistory(prev => [...prev, [...pages]]);
        setPages(next);
        setFuture(newFuture);
        setSelectedIds(new Set());
        setLastSelectedId(null);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                undo();
            } else if (
                ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') ||
                ((e.metaKey || e.ctrlKey) && e.key === 'y') ||
                ((e.metaKey || e.ctrlKey) && e.key === 'x') // Requested shortcut
            ) {
                // Only provide e.preventDefault() for redo if we are not in a context where cut is common
                // But since this is a global listener on the organiser, and we specifically want Cmd+X for redo...
                if (e.key === 'x' && (e.metaKey || e.ctrlKey)) {
                    // Check if we are in an input or textarea
                    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                        return;
                    }
                }
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pages, history, future]);

    // Load the first file from props
    const file = files.length > 0 ? files[0] : null;

    useEffect(() => {
        if (file) {
            loadFile(file.path);
        } else {
            setPages([]);
        }
    }, [file]);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        pageId: null,
        index: -1
    });

    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Click outside to close context menu
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (contextMenu.visible && contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu.visible]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement before drag starts to allow clicks
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const loadFile = async (path: string) => {
        setLoading(true);
        try {
            // Using get_organiser_pdf_metadata instead of list_pages
            const metadata = await invoke<any[]>("get_organiser_pdf_metadata", { path });
            const pageList: PdfPage[] = metadata.map(p => ({
                id: crypto.randomUUID(),
                type: 'existing',
                page_number: p.page_number,
                // Preview generation omitted for stability, fallback to number
            }));

            setPages(pageList);
            setHistory([]);
            setFuture([]);
            setStatus({ type: "info", text: "PDF loaded successfully" });
            setSelectedIds(new Set());
            setLastSelectedId(null);
        } catch (e) {
            setStatus({ type: "error", text: `Failed to load PDF: ${e}` });
        } finally {
            setLoading(false);
        }
    };

    // --- Drag and Drop Handlers (dnd-kit) ---

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setContextMenu(prev => ({ ...prev, visible: false })); // Close context menu
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            addToHistory(pages);
            setPages((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
        setActiveId(null);
    };

    // --- Selection & Actions ---

    const handleSelection = (e: React.MouseEvent, id: string, _index: number) => {
        e.stopPropagation();

        // 1. Command/Ctrl Click (Toggle)
        if (e.metaKey || e.ctrlKey) {
            const newSet = new Set(selectedIds);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
                setLastSelectedId(id);
            }
            setSelectedIds(newSet);
            return;
        }

        // 2. Shift Click (Range)
        if (e.shiftKey && lastSelectedId) {
            const lastIdx = pages.findIndex(p => p.id === lastSelectedId);
            const currentIdx = pages.findIndex(p => p.id === id);

            if (lastIdx !== -1 && currentIdx !== -1) {
                const start = Math.min(lastIdx, currentIdx);
                const end = Math.max(lastIdx, currentIdx);

                const newSet = new Set(selectedIds);
                for (let i = start; i <= end; i++) {
                    newSet.add(pages[i].id);
                }
                setSelectedIds(newSet);
                return;
            }
        }

        // 3. Simple Click (Select Single)
        setSelectedIds(new Set([id]));
        setLastSelectedId(id);
    };

    const insertBlank = () => {
        addToHistory(pages);
        const newBlank: PdfPage = { type: "blank", id: crypto.randomUUID() };
        setPages((prev) => {
            const next = [...prev];
            let insertIdx = prev.length;
            if (selectedIds.size > 0) {
                // Find index of the LAST selected item
                const indices = prev
                    .map((p, i) => selectedIds.has(p.id) ? i : -1)
                    .filter(i => i !== -1);
                insertIdx = Math.max(...indices) + 1;
            }
            next.splice(insertIdx, 0, newBlank);
            return next;
        });
    };

    const deleteSelected = () => {
        addToHistory(pages);
        setPages(prev => prev.filter(p => !selectedIds.has(p.id)));
        setSelectedIds(new Set());
        setLastSelectedId(null);
    };

    // --- Context Menu Handlers ---

    const handleContextMenu = (e: React.MouseEvent, pageId: string, index: number) => {
        e.preventDefault();
        // Determine position consistently
        const x = e.clientX;
        const y = e.clientY;

        // Select the item if not already selected (Finder style)
        if (!selectedIds.has(pageId)) {
            setSelectedIds(new Set([pageId]));
            setLastSelectedId(pageId);
        }

        setContextMenu({
            visible: true,
            x,
            y,
            pageId,
            index
        });
    };

    const contextAction = (action: 'blank-before' | 'blank-after' | 'delete') => {
        if (contextMenu.index === -1) return;

        addToHistory(pages);
        setPages(prev => {
            const next = [...prev];
            switch (action) {
                case 'blank-before':
                    next.splice(contextMenu.index, 0, { type: 'blank', id: crypto.randomUUID() });
                    break;
                case 'blank-after':
                    next.splice(contextMenu.index + 1, 0, { type: 'blank', id: crypto.randomUUID() });
                    break;
                case 'delete':
                    // If multiple items are selected and the target is part of selection, delete all
                    if (selectedIds.has(contextMenu.pageId!)) {
                        return next.filter(p => !selectedIds.has(p.id));
                    } else {
                        next.splice(contextMenu.index, 1);
                    }
                    break;
            }
            return next;
        });

        if (action === 'delete') {
            setSelectedIds(new Set());
            setLastSelectedId(null);
        }
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    const saveChanges = async () => {
        if (!file) return;
        const outputPath = await save({
            defaultPath: file.path.replace(".pdf", "_organised.pdf"),
            filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (!outputPath) return;

        setSaving(true);
        setStatus({ type: "info", text: "Saving your document..." });

        try {
            const actions: PageAction[] = pages.map((p) =>
                p.type === "existing" ? { type: "existing", page_number: p.page_number! } : { type: "blank" }
            );

            await invoke("apply_pdf_organisation", {
                inputPath: file.path,
                actions,
                outputPath,
            });

            setStatus({ type: "success", text: "Document saved successfully!" });
        } catch (e) {
            setStatus({ type: "error", text: `Failed to save: ${e}` });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="tool-container" onClick={() => { setSelectedIds(new Set()); setLastSelectedId(null); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} onClick={e => e.stopPropagation()}>
                <h2 className="tool-title" style={{ margin: 0 }}>PDF Organiser</h2>
                {file && (
                    <div className="tool-controls" style={{ display: 'flex', gap: 8 }}>
                        <div className="history-controls" style={{ display: 'flex', gap: 4, marginRight: 12 }}>
                            <button
                                onClick={undo}
                                disabled={history.length === 0}
                                className="btn btn-secondary"
                                title="Undo (Cmd+Z)"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                                ↩️ Undo
                            </button>
                            <button
                                onClick={redo}
                                disabled={future.length === 0}
                                className="btn btn-secondary"
                                title="Redo (Cmd+X)"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                                ↪️ Redo
                            </button>
                        </div>
                        <button onClick={onReset} className="btn btn-secondary">Reset</button>
                    </div>
                )}
            </div>

            {!file ? (
                <section className="section" onClick={e => e.stopPropagation()}>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Loading PDF...
                        </div>
                    ) : (
                        <div
                            className={`drop-zone ${dragOver ? "drag-over" : ""}`}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onClick={onPickFiles}
                        >
                            <p className="primary">Drop a PDF here to start organising</p>
                            <p>or click to select</p>
                        </div>
                    )}
                </section>
            ) : (
                <>
                    <section className="section" style={{ background: 'rgba(255,255,255,0.5)', padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            {/* ... Selection Logic (omitted for brevity, can keep existing) ... */}
                            <button onClick={insertBlank} className="btn btn-secondary">
                                <span style={{ marginRight: 4 }}>+</span> Blank
                            </button>

                            <button
                                onClick={deleteSelected}
                                className="btn"
                                style={{
                                    background: selectedIds.size > 0 ? 'rgba(220, 38, 38, 0.1)' : 'var(--surface)',
                                    color: selectedIds.size > 0 ? 'var(--error)' : 'var(--text-secondary)',
                                    border: `1px solid ${selectedIds.size > 0 ? 'rgba(220, 38, 38, 0.2)' : 'var(--border)'}`
                                }}
                                disabled={selectedIds.size === 0}
                            >
                                <span style={{ marginRight: 4 }}>🗑️</span> Delete ({selectedIds.size})
                            </button>

                            <div style={{ flex: 1 }}></div>

                            <button onClick={saveChanges} disabled={saving} className="btn btn-primary">
                                {saving ? "Saving..." : "Save PDF"}
                            </button>
                        </div>
                    </section>

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="organise-grid">
                            <SortableContext
                                items={pages.map(p => p.id)}
                                strategy={rectSortingStrategy}
                            >
                                {pages.map((page, idx) => (
                                    <SortableItem
                                        key={page.id}
                                        id={page.id}
                                        page={page}
                                        selected={selectedIds.has(page.id)}
                                        onClick={handleSelection}
                                        onContextMenu={(e, id) => handleContextMenu(e, id, idx)}
                                        filePath={file.path}
                                    />
                                ))}
                            </SortableContext>
                        </div>
                        <DragOverlay>
                            {activeId ? (
                                <SortableItem
                                    id={activeId}
                                    page={pages.find(p => p.id === activeId)!}
                                    selected={selectedIds.has(activeId)}
                                    // No-ops for overlay
                                    onContextMenu={() => { }}
                                    onClick={() => { }}
                                    isOverlay
                                />
                            ) : null}
                        </DragOverlay>
                    </DndContext>
                </>
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                    ref={contextMenuRef}
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1000,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        padding: '4px 0',
                        minWidth: 160
                    }}
                >
                    <div className="context-menu-item" onClick={() => contextAction('blank-before')}>
                        Insert Blank Before
                    </div>
                    <div className="context-menu-item" onClick={() => contextAction('blank-after')}>
                        Insert Blank After
                    </div>
                    <div className="context-menu-separator" style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}></div>
                    <div className="context-menu-item delete" onClick={() => contextAction('delete')} style={{ color: 'var(--error)' }}>
                        Delete Page
                    </div>
                </div>
            )}
        </div>
    );
}

// Add CSS for context menu items
const styles = document.createElement('style');
styles.innerHTML = `
    .context-menu-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        color: var(--text);
    }
    .context-menu-item:hover {
        background: var(--hover);
    }
    .context-menu-item.delete:hover {
        background: rgba(220, 38, 38, 0.1);
    }
`;
document.head.appendChild(styles);
