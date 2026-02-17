import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { Save } from 'lucide-react';

interface LargeFileViewerProps {
    filePath: string;
    fileSize: number;
}

interface IndexResponse {
    total_lines: number;
    file_size: number;
}

interface LinesResponse {
    content: string;
    start_line: number;
    lines_read: number;
}

const LINES_PER_CHUNK = 200;       // How many lines to fetch per chunk
const LINE_HEIGHT_PX = 20;         // Assumed line height in pixels

export default function LargeFileViewer({ filePath, fileSize }: LargeFileViewerProps) {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [totalLines, setTotalLines] = useState(0);
    const [currentStartLine, setCurrentStartLine] = useState(0);
    const [linesInChunk, setLinesInChunk] = useState(0);
    const [isDirty, setIsDirty] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const isIndexing = useRef(false);

    // ── Index the file on mount ───────────────────────────────────────────
    useEffect(() => {
        const doIndex = async () => {
            if (isIndexing.current) return;
            isIndexing.current = true;
            try {
                const response = await invoke<IndexResponse>("index_file", { path: filePath });
                setTotalLines(response.total_lines);
                // Fetch first chunk
                await fetchLines(0);
            } catch (err) {
                console.error("Failed to index file:", err);
            } finally {
                isIndexing.current = false;
            }
        };
        doIndex();
    }, [filePath]);

    // ── Fetch lines by line number ────────────────────────────────────────
    const fetchLines = async (startLine: number) => {
        setIsLoading(true);
        try {
            const response = await invoke<LinesResponse>("read_lines", {
                path: filePath,
                startLine: startLine,
                lineCount: LINES_PER_CHUNK,
            });
            setContent(response.content);
            setCurrentStartLine(response.start_line);
            setLinesInChunk(response.lines_read);
            setIsDirty(false);
        } catch (err) {
            console.error("Failed to read lines:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Scroll handler ────────────────────────────────────────────────────
    const handleScroll = useCallback(async () => {
        if (!scrollRef.current || isLoading) return;

        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const maxScrollTop = scrollHeight - clientHeight;
        const scrollPercent = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;

        // Map scroll position to a line number
        const targetLine = Math.floor(scrollPercent * Math.max(0, totalLines - LINES_PER_CHUNK));
        const safeLine = Math.max(0, Math.min(targetLine, totalLines - LINES_PER_CHUNK));

        // Only refetch if we've scrolled far enough (> 20 lines from current chunk start)
        if (Math.abs(safeLine - currentStartLine) < 20) return;

        await fetchLines(safeLine);
    }, [filePath, totalLines, currentStartLine, isLoading]);

    // ── Save handler ──────────────────────────────────────────────────────
    const handleSave = async () => {
        setIsLoading(true);
        try {
            const response = await invoke<IndexResponse>("patch_file_lines", {
                path: filePath,
                startLine: currentStartLine,
                originalLineCount: linesInChunk,
                newContent: content,
            });
            setTotalLines(response.total_lines);
            setIsDirty(false);

            // Re-fetch the same region to get clean state
            await fetchLines(currentStartLine);
        } catch (err) {
            console.error("Failed to save:", err);
            alert("Failed to save changes: " + err);
        } finally {
            setIsLoading(false);
        }
    };

    // ── Virtual scroll height ─────────────────────────────────────────────
    const virtualHeight = totalLines * LINE_HEIGHT_PX;

    return (
        <div className="large-file-viewer">
            <div className="large-file-banner" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>
                        Large File ({(fileSize / 1024 / 1024).toFixed(2)} MB)
                        — {totalLines.toLocaleString()} lines
                    </span>
                    <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                        Lines {currentStartLine.toLocaleString()} – {(currentStartLine + linesInChunk).toLocaleString()}
                        {isDirty && " • Unsaved Changes"}
                    </span>
                </div>

                {isDirty && (
                    <button
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={isLoading}
                        style={{ display: 'flex', gap: '5px', padding: '4px 10px', fontSize: '0.9em' }}
                    >
                        <Save size={14} /> Save
                    </button>
                )}
            </div>

            <div
                ref={scrollRef}
                className="virtual-scroll-container"
                style={{ overflowY: 'auto', position: 'relative' }}
                onScroll={handleScroll}
            >
                {/* Phantom div for scrollbar height */}
                <div style={{ height: virtualHeight, position: 'absolute', top: 0, left: 0, width: '1px' }} />

                {/* Sticky content that stays in view */}
                <div style={{
                    position: 'sticky',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '100%',
                    background: 'var(--bg-color)',
                }}>
                    {isLoading && <div className="loading-overlay">Loading...</div>}

                    <textarea
                        className="large-file-editor"
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            setIsDirty(true);
                        }}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            background: 'transparent',
                            color: 'inherit',
                            fontFamily: 'monospace',
                            fontSize: '14px',
                            resize: 'none',
                            padding: '1rem',
                            outline: 'none',
                            lineHeight: `${LINE_HEIGHT_PX}px`,
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                        }}
                        spellCheck={false}
                    />
                </div>
            </div>
        </div>
    );
}
