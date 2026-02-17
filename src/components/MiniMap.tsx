import { useRef, useEffect, useCallback, useState } from 'react';

interface MiniMapProps {
    content: string;
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    onScroll: (scrollTop: number) => void;
}

const CHAR_WIDTH = 1.2;
const CHAR_HEIGHT = 2;
const LINE_GAP = 1;
const MAP_WIDTH = 80;
const MAX_CHARS_PER_LINE = 60;  // Only render first N chars per line
const MAX_LINES = 5000;          // Cap for very large files

export default function MiniMap({ content, scrollTop, scrollHeight, clientHeight, onScroll }: MiniMapProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const [canvasHeight, setCanvasHeight] = useState(0);

    const lines = content.split('\n');
    const displayLines = lines.slice(0, MAX_LINES);
    const totalContentHeight = displayLines.length * (CHAR_HEIGHT + LINE_GAP);

    // Compute scale: if content is taller than the container, scale down to fit
    const containerHeight = canvasHeight || 400;
    const scale = totalContentHeight > containerHeight
        ? containerHeight / totalContentHeight
        : 1;

    const scaledLineHeight = (CHAR_HEIGHT + LINE_GAP) * scale;

    // ── Render Canvas ─────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const displayHeight = Math.min(totalContentHeight * scale, containerHeight);

        canvas.width = MAP_WIDTH * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = `${MAP_WIDTH}px`;
        canvas.style.height = `${displayHeight}px`;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, MAP_WIDTH, displayHeight);

        // Draw each line as a series of tiny rectangles
        const textColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-dim').trim() || '#888';

        displayLines.forEach((line, lineIdx) => {
            const y = lineIdx * scaledLineHeight;
            const trimmed = line.substring(0, MAX_CHARS_PER_LINE);

            for (let charIdx = 0; charIdx < trimmed.length; charIdx++) {
                const ch = trimmed[charIdx];
                if (ch === ' ' || ch === '\t') continue;

                const x = charIdx * CHAR_WIDTH * scale;
                const w = CHAR_WIDTH * scale;
                const h = CHAR_HEIGHT * scale;

                // Vary opacity slightly for visual interest
                const isKeyword = /[A-Z]/.test(ch);
                ctx.fillStyle = isKeyword
                    ? `${textColor}`
                    : `${textColor}99`;
                ctx.fillRect(x, y, Math.max(w, 0.8), Math.max(h, 0.8));
            }
        });
    }, [content, canvasHeight, scale, scaledLineHeight]);

    // ── Resize Observer ───────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                setCanvasHeight(entry.contentRect.height);
            }
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    // ── Viewport Indicator ────────────────────────────────────────────────
    const scrollRatio = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const viewportRatio = scrollHeight > 0 ? clientHeight / scrollHeight : 1;
    const canvasDisplayHeight = Math.min(totalContentHeight * scale, containerHeight);

    const viewportTop = scrollRatio * canvasDisplayHeight;
    const viewportHeight = Math.max(viewportRatio * canvasDisplayHeight, 20);

    // ── Click / Drag ──────────────────────────────────────────────────────
    const handlePointerEvent = useCallback((clientY: number) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const y = clientY - rect.top;
        const ratio = y / canvasDisplayHeight;

        // Center the viewport at click position
        const targetScrollTop = (ratio * scrollHeight) - (clientHeight / 2);
        onScroll(Math.max(0, Math.min(targetScrollTop, scrollHeight - clientHeight)));
    }, [canvasDisplayHeight, scrollHeight, clientHeight, onScroll]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        handlePointerEvent(e.clientY);

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging.current) {
                handlePointerEvent(e.clientY);
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="minimap"
            ref={containerRef}
            onMouseDown={handleMouseDown}
        >
            <canvas ref={canvasRef} />
            <div
                className="minimap-viewport"
                style={{
                    top: viewportTop,
                    height: viewportHeight,
                }}
            />
        </div>
    );
}
