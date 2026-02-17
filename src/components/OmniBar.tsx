import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, File, Terminal, ArrowRight, CornerDownLeft } from 'lucide-react';


interface OmniBarProps {
    isOpen: boolean;
    onClose: () => void;
    tabs: { id: string; fileName: string; filePath: string }[];
    onSelectFile: (filePath: string) => void;
    onJumpToLine: (line: number) => void;
    onRunCommand: (command: string) => void;
}

type Mode = 'file' | 'line' | 'command';

export default function OmniBar({ isOpen, onClose, tabs, onSelectFile, onJumpToLine, onRunCommand }: OmniBarProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            // Slight delay to ensure render
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    // Detect Mode
    const mode: Mode = useMemo(() => {
        if (query.startsWith(':')) return 'line';
        if (query.startsWith('>')) return 'command';
        return 'file';
    }, [query]);

    // Filter Items
    const items = useMemo(() => {
        if (mode === 'line') return [];
        if (mode === 'command') {
            const cmdQuery = query.slice(1).toLowerCase();
            const commands = [
                { id: 'toggle-terminal', label: 'Toggle Terminal', action: 'toggle_terminal' },
                { id: 'toggle-theme', label: 'Toggle Theme', action: 'toggle_theme' },
                { id: 'save-file', label: 'Save File', action: 'save_file' },
                { id: 'close-tab', label: 'Close Tab', action: 'close_tab' },
            ];
            return commands.filter(c => c.label.toLowerCase().includes(cmdQuery));
        }
        // File Mode (Tabs only for now, could expand to file system later)
        if (!query) return tabs;
        const q = query.toLowerCase();
        return tabs.filter(t =>
            t.fileName.toLowerCase().includes(q) ||
            t.filePath.toLowerCase().includes(q)
        );
    }, [query, mode, tabs]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % (items.length || 1));
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + (items.length || 1)) % (items.length || 1));
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (mode === 'line') {
                const line = parseInt(query.slice(1), 10);
                if (!isNaN(line)) {
                    onJumpToLine(line);
                    onClose();
                }
            } else if (items.length > 0) {
                const item = items[selectedIndex];
                if (mode === 'file') {
                    onSelectFile((item as any).filePath);
                } else {
                    onRunCommand((item as any).action);
                }
                onClose();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="omnibar-container" style={{
                background: 'var(--bg-darker)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                width: '600px',
                maxWidth: '90%',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'scaleIn 0.15s ease-out',
                position: 'relative',
                top: '-15%' // Position slightly higher than center
            }}>
                <div className="omnibar-input-wrapper" style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    gap: '12px'
                }}>
                    {mode === 'file' && <Search size={20} color="var(--text-dim)" />}
                    {mode === 'line' && <ArrowRight size={20} color="var(--accent-color)" />}
                    {mode === 'command' && <Terminal size={20} color="var(--accent-color)" />}

                    <input
                        ref={inputRef}
                        type="text"
                        className="omnibar-input"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder={mode === 'file' ? "Search files..." : mode === 'line' ? "Go to line..." : "Run command..."}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-color)',
                            fontSize: '16px',
                            width: '100%',
                            outline: 'none',
                            fontFamily: 'var(--font-family)'
                        }}
                    />
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px' }}>ESC</div>
                </div>

                {mode !== 'line' && (
                    <div className="omnibar-results" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {items.length === 0 ? (
                            <div style={{ padding: '16px', color: 'var(--text-dim)', textAlign: 'center' }}>No results found</div>
                        ) : (
                            items.map((item, index) => (
                                <div
                                    key={(item as any).id || (item as any).filePath}
                                    className={`omnibar-item ${index === selectedIndex ? 'selected' : ''}`}
                                    onClick={() => {
                                        if (mode === 'file') onSelectFile((item as any).filePath);
                                        else onRunCommand((item as any).action);
                                        onClose();
                                    }}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    style={{
                                        padding: '10px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        cursor: 'pointer',
                                        background: index === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                                        borderLeft: index === selectedIndex ? '2px solid var(--accent-color)' : '2px solid transparent'
                                    }}
                                >
                                    {mode === 'file' ? <File size={16} color="var(--text-dim)" /> : <Terminal size={16} color="var(--text-dim)" />}
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <span style={{ fontSize: '14px', color: 'var(--text-color)' }}>{(item as any).fileName || (item as any).label}</span>
                                        {mode === 'file' && <span style={{ fontSize: '11px', color: 'var(--text-dim)', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(item as any).filePath}</span>}
                                    </div>
                                    {index === selectedIndex && <CornerDownLeft size={14} color="var(--text-dim)" style={{ marginLeft: 'auto' }} />}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {mode === 'line' && (
                    <div style={{ padding: '16px', color: 'var(--text-dim)', textAlign: 'center', fontSize: '13px' }}>
                        Type a line number and press Enter to jump.
                    </div>
                )}
            </div>
        </div>
    );
}
