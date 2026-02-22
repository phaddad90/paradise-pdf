import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { invoke } from '@tauri-apps/api/core';

// Ensure worker is set (though it might be set globally elsewhere, it's safe to set it again or check)
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PdfThumbnailProps {
    path: string;
    pageNumber: number; // 1-based
    scale?: number;
    rotation?: number;
    className?: string;
}

// Simple in-memory cache for loaded documents to avoid re-reading binary for every page
// Key: path, Value: Promise<PDFDocumentProxy>
const docCache: Record<string, Promise<any>> = {};

const getCachedDocument = (path: string) => {
    if (!docCache[path]) {
        docCache[path] = (async () => {
            try {
                // Read file as binary
                const data = await invoke<number[]>("read_pdf_buffer", { path });
                const uint8Array = new Uint8Array(data);
                const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
                return loadingTask.promise;
            } catch (e) {
                if (import.meta.env.DEV) console.error("Failed to load PDF for thumbnail:", e);
                delete docCache[path]; // Remove failed attempt
                throw e;
            }
        })();
    }
    return docCache[path];
};

export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({
    path,
    pageNumber,
    scale = 1.0,
    rotation = 0,
    className
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);

        const render = async () => {
            try {
                const pdf = await getCachedDocument(path);
                if (!mounted) return;

                const page = await pdf.getPage(pageNumber);
                if (!mounted) return;

                const viewport = page.getViewport({ scale, rotation });
                const canvas = canvasRef.current;

                if (canvas) {
                    const context = canvas.getContext('2d');
                    if (context) {
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        // Cancel any previous render task on this canvas (though we usually remount)
                        if (renderTaskRef.current) {
                            renderTaskRef.current.cancel();
                        }

                        const renderContext = {
                            canvasContext: context,
                            viewport: viewport,
                        };

                        const task = page.render(renderContext);
                        renderTaskRef.current = task;

                        await task.promise;
                    }
                }
            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    if (import.meta.env.DEV) console.error(`Error rendering page ${pageNumber}:`, err);
                    if (mounted) setError("Failed to load image");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        render();

        return () => {
            mounted = false;
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [path, pageNumber, scale, rotation]);

    return (
        <div className={`pdf-thumbnail ${className || ''}`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
            {loading && <span style={{ fontSize: '10px', color: '#9ca3af' }}>Loading...</span>}
            {error && <span style={{ fontSize: '10px', color: '#ef4444' }}>Error</span>}
            <canvas
                ref={canvasRef}
                style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    display: loading || error ? 'none' : 'block',
                    objectFit: 'contain'
                }}
            />
        </div>
    );
};
