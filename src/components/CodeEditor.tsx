import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useHistory } from '../hooks/useHistory';
import { useMultiCursor } from "../hooks/useMultiCursor";
import SearchOverlay from './SearchOverlay';
import MiniMap from './MiniMap';
import { Settings } from '../hooks/useSettings';
import hljs from 'highlight.js';

interface EditorProps {
    content: string;
    onChange: (value: string) => void;
    onSave: () => void;
    settings: Settings;
    fileExtension: string;
    filePath: string;
}

interface Match {
    start: number;
    end: number;
}

// Map file extensions to highlight.js language names
const EXT_TO_LANG: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
    rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    xml: 'xml', html: 'xml', css: 'css', scss: 'scss',
    sql: 'sql', sh: 'bash', bash: 'bash', zsh: 'bash',
    lua: 'lua', r: 'r', dart: 'dart', zig: 'zig',
    dockerfile: 'dockerfile', makefile: 'makefile',
};

export default function Editor({ content: initialContent, onChange: parentOnChange, onSave, settings, fileExtension, filePath }: EditorProps) {
    const { state: content, set, undo, redo, reset } = useHistory(initialContent);

    // UI Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const highlightsRef = useRef<HTMLDivElement>(null);

    // Search State
    const [showSearch, setShowSearch] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
    const [searchQuery, setSearchQuery] = useState("");

    // Scroll state for minimap
    const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

    // Guard: prevent sync-to-parent during tab switch reset
    const isResettingRef = useRef(false);

    // Reset history when the file changes (tab switch)
    useEffect(() => {
        isResettingRef.current = true;
        reset(initialContent);
    }, [filePath, reset]);

    // Sync changes to parent (skip during reset to avoid feedback loop)
    useEffect(() => {
        if (isResettingRef.current) {
            isResettingRef.current = false;
            return;
        }
        if (content !== initialContent) {
            parentOnChange(content);
        }
    }, [content, parentOnChange, initialContent]);

    // Re-run search whenever content changes if highlight is active
    useEffect(() => {
        if (searchQuery) {
            performSearch(searchQuery);
        }
    }, [content]);

    const performSearch = (query: string) => {
        setSearchQuery(query);
        if (!query) {
            setMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }

        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const newMatches: Match[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            newMatches.push({ start: match.index, end: match.index + match[0].length });
        }
        setMatches(newMatches);

        // Try to keep current index valid or reset
        if (newMatches.length > 0) {
            setCurrentMatchIndex(prev => (prev >= 0 && prev < newMatches.length) ? prev : 0);
        } else {
            setCurrentMatchIndex(-1);
        }
    };

    const jumpToMatch = (index: number) => {
        if (index >= 0 && index < matches.length && textareaRef.current) {
            const match = matches[index];
            const ta = textareaRef.current;
            ta.focus();
            ta.setSelectionRange(match.start, match.end);
            ta.blur();
            ta.focus();
            setCurrentMatchIndex(index);
        }
    };

    const handleNext = () => {
        if (matches.length === 0) return;
        const next = (currentMatchIndex + 1) % matches.length;
        jumpToMatch(next);
    };

    const handlePrev = () => {
        if (matches.length === 0) return;
        const prev = (currentMatchIndex - 1 + matches.length) % matches.length;
        jumpToMatch(prev);
    };

    const handleReplace = (query: string, replaceText: string, replaceAll: boolean) => {
        if (!query || matches.length === 0) return;

        let newContent = content;

        if (replaceAll) {
            newContent = content.replaceAll(query, replaceText);
            const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            newContent = content.replace(regex, replaceText);
            set(newContent);
        } else {
            if (currentMatchIndex >= 0) {
                const match = matches[currentMatchIndex];
                const before = content.substring(0, match.start);
                const after = content.substring(match.end);
                newContent = before + replaceText + after;
                set(newContent);
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.setSelectionRange(match.start + replaceText.length, match.start + replaceText.length);
                    }
                }, 0);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (cursors.length > 0) return;
        set(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Multi-Cursor: Ctrl+D
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
            e.preventDefault();
            if (cursors.length === 0 && textareaRef.current) {
                const start = textareaRef.current.selectionStart;
                const end = textareaRef.current.selectionEnd;

                const selectedText = content.substring(start, end);
                if (selectedText.length > 0) {
                    setSearchQuery(selectedText);
                    performSearch(selectedText);
                }

                if (start !== end) {
                    addCursor(start, end);
                    setTimeout(() => addNextOccurrence(content), 0);
                    return;
                }
                if (start === end) {
                    let s = start;
                    let en = end;
                    while (s > 0 && /\w/.test(content[s - 1])) s--;
                    while (en < content.length && /\w/.test(content[en])) en++;
                    if (s !== en) {
                        addCursor(s, en);
                        return;
                    }
                }
                addCursor(start, end);
                return;
            }
            addNextOccurrence(content);
            return;
        }

        // Multi-Cursor: Typing
        if (cursors.length > 0) {
            if (e.key === 'Escape' || e.key.startsWith('Arrow')) {
                clearCursors();
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                const { newContent, newCursors } = applyEdit(content, 'insert', e.key);
                set(newContent);
                setCursors(newCursors);
                return;
            }
            if (e.key === 'Backspace') {
                e.preventDefault();
                const { newContent, newCursors } = applyEdit(content, 'delete');
                set(newContent);
                setCursors(newCursors);
                return;
            }
            if (e.key === 'Delete') {
                e.preventDefault();
                // We need to implement 'deleteForward' in logic or simulate it?
                // Logic currently only supports 'delete' (backward) or 'insert'.
                // Ideally we update applyEdit to support 'deleteForward'.
                // For now, let's leave valid comment or implement it if easy.
                // Implementing deleteForward in hook is cleaner. 
                // Let's assume we update hook next or now.
                // Actually, let's stick to Backspace for now to match current hook capabilities 
                // UNLESS I update the hook first.
                // I will update the hook to support 'deleteForward'.
                const { newContent, newCursors } = applyEdit(content, 'deleteForward');
                set(newContent);
                setCursors(newCursors);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                const { newContent, newCursors } = applyEdit(content, 'insert', '\n');
                set(newContent);
                setCursors(newCursors);
                return;
            }
        }

        // Standard Keys
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const value = e.currentTarget.value;
            const newValue = value.substring(0, start) + ' '.repeat(settings.tabSize || 4) + value.substring(end);
            set(newValue);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + (settings.tabSize || 4);
                }
            }, 0);
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
            if (cursors.length > 0) exitMultiCursorMode();
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
            e.preventDefault();
            onSave();
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        }

        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
            e.preventDefault();
            redo();
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            setShowSearch(true);
        }

        if (e.key === 'Escape') {
            if (cursors.length > 0 || searchQuery) {
                exitMultiCursorMode();
            }
            if (showSearch) setShowSearch(false);
        }
    };

    const exitMultiCursorMode = () => {
        clearCursors();
        setCursors([]);
        if (!showSearch) {
            setSearchQuery("");
            setMatches([]);
        }
    };

    const handleScroll = useCallback(() => {
        if (!textareaRef.current) return;

        const ta = textareaRef.current;
        const top = ta.scrollTop;
        const left = ta.scrollLeft;

        if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = top;
        if (highlightsRef.current) {
            highlightsRef.current.scrollTop = top;
            highlightsRef.current.scrollLeft = left;
        }

        requestAnimationFrame(() => {
            setScrollInfo({ scrollTop: top, scrollHeight: ta.scrollHeight, clientHeight: ta.clientHeight });
        });
    }, []);

    // Sync initial scroll
    useEffect(() => {
        if (textareaRef.current) {
            const ta = textareaRef.current;
            setScrollInfo({ scrollTop: ta.scrollTop, scrollHeight: ta.scrollHeight, clientHeight: ta.clientHeight });
        }
    }, [content]);

    const handleMiniMapScroll = useCallback((newScrollTop: number) => {
        if (textareaRef.current) {
            textareaRef.current.scrollTop = newScrollTop;
            handleScroll();
        }
    }, []);

    // ── Highlighting ──────────────────────────────────────────────────────
    const [asyncHtml, setAsyncHtml] = useState<{ id: string, html: string } | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const latestWorkerId = useRef<string>('');

    useEffect(() => {
        workerRef.current = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
        workerRef.current.onmessage = (e) => {
            const { type, id, html } = e.data;
            if (type === 'HIGHLIGHT_CODE_RESULT') {
                setAsyncHtml({ id, html });
            }
        };
        return () => workerRef.current?.terminate();
    }, []);

    const isLargeFile = content.length > 50000;

    useEffect(() => {
        if (!isLargeFile) return;

        const timer = setTimeout(() => {
            const id = Date.now().toString() + Math.random().toString();
            latestWorkerId.current = id;
            const lang = EXT_TO_LANG[fileExtension.toLowerCase()] || '';
            workerRef.current?.postMessage({
                type: 'HIGHLIGHT_CODE',
                content,
                language: lang,
                id
            });
        }, 50);

        return () => clearTimeout(timer);
    }, [content, fileExtension, isLargeFile]);

    const syncHtml = useMemo(() => {
        if (!content || isLargeFile) return null;
        const lang = EXT_TO_LANG[fileExtension.toLowerCase()] || '';
        try {
            if (lang) {
                return hljs.highlight(content, { language: lang, ignoreIllegals: true }).value;
            }
            const auto = hljs.highlightAuto(content);
            return auto.value;
        } catch {
            return null;
        }
    }, [content, fileExtension, isLargeFile]);

    const highlightedHTML = isLargeFile ?
        (asyncHtml && asyncHtml.id === latestWorkerId.current ? asyncHtml.html : null)
        : syncHtml;

    // ── Multi-Cursor & Input Handling ─────────────────────────────────────
    const { cursors, setCursors, addCursor, clearCursors, applyEdit, addNextOccurrence } = useMultiCursor();

    const getCoordinates = useCallback((index: number) => {
        if (!content) return { top: 0, left: 0 };
        let row = 0;
        let lineStart = 0;
        for (let i = 0; i < index; i++) {
            if (content[i] === '\n') {
                row++;
                lineStart = i + 1;
            }
        }
        let visualCol = 0;
        for (let i = lineStart; i < index; i++) {
            if (content[i] === '\t') {
                visualCol += 4 - (visualCol % 4);
            } else {
                visualCol++;
            }
        }
        const lineHeightPx = Math.round((settings.fontSize || 14) * 1.6);
        const padding = 24;
        return {
            top: `${(row * lineHeightPx) + padding}px`,
            left: `calc(${visualCol}ch + ${padding}px)`
        };
    }, [content, settings.fontSize]);

    const renderHighlights = () => {
        if (highlightedHTML && (!searchQuery || matches.length === 0)) {
            return <span dangerouslySetInnerHTML={{ __html: highlightedHTML }} />;
        }
        if (!highlightedHTML) {
            if (!searchQuery || matches.length === 0) return content;
            const nodes: React.ReactNode[] = [];
            let lastIndex = 0;
            matches.forEach((match, i) => {
                nodes.push(content.substring(lastIndex, match.start));
                const isCurrent = i === currentMatchIndex;
                nodes.push(
                    <mark key={i} className={isCurrent ? 'current-match' : ''}>
                        {content.substring(match.start, match.end)}
                    </mark>
                );
                lastIndex = match.end;
            });
            nodes.push(content.substring(lastIndex));
            return nodes;
        }
        return (
            <>
                <span dangerouslySetInnerHTML={{ __html: highlightedHTML }} />
                <div className="search-marks-overlay" style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    pointerEvents: 'none', padding: '24px', boxSizing: 'border-box'
                }}>
                    {(() => {
                        const nodes: React.ReactNode[] = [];
                        let lastIndex = 0;
                        matches.forEach((match, i) => {
                            nodes.push(<span key={`t${i}`} style={{ visibility: 'hidden' }}>{content.substring(lastIndex, match.start)}</span>);
                            const isCurrent = i === currentMatchIndex;
                            nodes.push(
                                <mark key={i} className={isCurrent ? 'current-match' : ''}>
                                    {content.substring(match.start, match.end)}
                                </mark>
                            );
                            lastIndex = match.end;
                        });
                        nodes.push(<span key="last" style={{ visibility: 'hidden' }}>{content.substring(lastIndex)}</span>);
                        return nodes;
                    })()}
                </div>
            </>
        );
    };

    const lineCount = content.split('\n').length;
    const lines = Array.from({ length: lineCount }, (_, i) => i + 1);
    const fontSize = settings.fontSize || 14;
    const lineHeight = Math.round(fontSize * 1.6) + 'px';

    const renderLineNumbers = () => {
        if (!settings.showLineNumbers) return null;
        return (
            <div className="line-numbers" ref={lineNumbersRef} style={{ fontSize: `${fontSize}px`, lineHeight }}>
                {lines.map(n => <div key={n}>{n}</div>)}
            </div>
        );
    };

    // ── External Events (Jump to Line) ────────────────────────────────────
    // Keep content ref for event handlers to avoid re-binding
    const contentRef = useRef(content);
    useEffect(() => { contentRef.current = content; }, [content]);

    // ── External Events (Jump to Line) ────────────────────────────────────
    useEffect(() => {
        const handleJump = (e: Event) => {
            const customEvent = e as CustomEvent;
            const line = customEvent.detail?.line;

            if (typeof line === 'number' && textareaRef.current && line >= 1) {
                const ta = textareaRef.current;
                const currentContent = contentRef.current;

                // 1. Calculate character index for the start of the line
                let charIndex = 0;
                let currentLine = 1;

                if (line > 1) {
                    for (let i = 0; i < currentContent.length; i++) {
                        if (currentContent[i] === '\n') {
                            currentLine++;
                            if (currentLine === line) {
                                charIndex = i + 1;
                                break;
                            }
                        }
                    }
                }

                // If requested line is beyond file, go to end
                if (currentLine < line) {
                    charIndex = currentContent.length;
                }

                // 2. Calculate Scroll Position (Centered)
                const lineHeightVal = parseInt(lineHeight, 10) || 22;
                const top = (line - 1) * lineHeightVal;
                const centeredTop = Math.max(0, top - (ta.clientHeight / 2) + lineHeightVal);

                // 3. Execute Move
                // We focus first, then set selection, then scroll.
                ta.focus();
                ta.setSelectionRange(charIndex, charIndex);

                // Use auto behavior for instant jump, or smooth if preferred. Instant is more "editor-like".
                ta.scrollTo({ top: centeredTop, behavior: 'auto' });

                // Force scroll again in next frame to fight browser auto-scroll behavior on focus
                requestAnimationFrame(() => {
                    ta.scrollTo({ top: centeredTop, behavior: 'auto' });
                });
            }
        };

        window.addEventListener('peek:jump-to-line', handleJump);
        return () => window.removeEventListener('peek:jump-to-line', handleJump);
    }, [lineHeight]);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
            {showSearch && (
                <SearchOverlay
                    onClose={() => { setShowSearch(false); setSearchQuery(""); setMatches([]); }}
                    onSearch={performSearch}
                    onReplace={handleReplace}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    matchCount={matches.length}
                    currentMatch={currentMatchIndex}
                />
            )}

            <div className="editor-container" style={{ fontSize: `${fontSize}px`, display: 'flex', height: '100%', width: '100%' }}>
                {renderLineNumbers()}

                <div className="editor-content" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <textarea
                        ref={textareaRef}
                        className="editor-textarea"
                        value={content}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onClick={() => (cursors.length > 0 || (searchQuery && !showSearch)) && exitMultiCursorMode()}
                        onScroll={handleScroll}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        wrap={settings.wordWrap ? 'soft' : 'off'}
                        style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: lineHeight,
                            whiteSpace: settings.wordWrap ? 'pre-wrap' : 'pre',
                            overflowWrap: settings.wordWrap ? 'break-word' : undefined,
                            tabSize: 4,
                            caretColor: cursors.length > 0 ? 'transparent' : 'var(--text-color)',
                            zIndex: 10,
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'transparent',
                        }}
                    />

                    <div
                        className="editor-highlights"
                        ref={highlightsRef}
                        style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: lineHeight,
                            whiteSpace: settings.wordWrap ? 'pre-wrap' : 'pre',
                            overflowWrap: settings.wordWrap ? 'break-word' : undefined,
                            tabSize: 4,
                        }}
                    >
                        {renderHighlights()}
                        {cursors.map(c => {
                            const startCoords = getCoordinates(Math.min(c.start, c.end));
                            if (c.start !== c.end) {
                                return (
                                    <div key={c.id} className="cursor-selection" style={{
                                        top: startCoords.top,
                                        left: startCoords.left,
                                        width: `${Math.abs(c.end - c.start)}ch`
                                    }} />
                                );
                            }
                            return (
                                <div key={c.id} className="cursor-caret" style={{
                                    top: startCoords.top,
                                    left: startCoords.left
                                }} />
                            );
                        })}
                    </div>
                </div>
            </div>
            {settings.showMiniMap && (
                <MiniMap
                    content={content}
                    scrollTop={scrollInfo.scrollTop}
                    scrollHeight={scrollInfo.scrollHeight}
                    clientHeight={scrollInfo.clientHeight}
                    onScroll={handleMiniMapScroll}
                />
            )}
        </div>
    );
}
