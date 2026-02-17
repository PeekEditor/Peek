import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
    visible: boolean;
    onClose: () => void;
    cwd?: string | null;
}

export default function TerminalPanel({ visible, onClose, cwd }: TerminalPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitRef = useRef<FitAddon | null>(null);
    const idRef = useRef<number | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Read theme colors from CSS variables
    const getThemeColors = useCallback(() => {
        const root = document.documentElement;
        const get = (v: string, fallback: string) =>
            getComputedStyle(root).getPropertyValue(v).trim() || fallback;

        return {
            background: get('--bg-darker', '#0a0a0a'),
            foreground: get('--text-color', '#e0e0e0'),
            cursor: get('--accent-color', '#3b82f6'),
            cursorAccent: get('--bg-color', '#0f0f0f'),
            selectionBackground: 'rgba(59, 130, 246, 0.3)',
            black: '#1e1e1e',
            red: get('--syn-variable', '#e06c75'),
            green: get('--syn-string', '#98c379'),
            yellow: get('--syn-type', '#e5c07b'),
            blue: get('--syn-function', '#61afef'),
            magenta: get('--syn-keyword', '#c678dd'),
            cyan: get('--syn-operator', '#56b6c2'),
            white: get('--text-color', '#e0e0e0'),
            brightBlack: get('--text-dim', '#5c6370'),
            brightRed: '#e06c75',
            brightGreen: '#98c379',
            brightYellow: '#e5c07b',
            brightBlue: '#61afef',
            brightMagenta: '#c678dd',
            brightCyan: '#56b6c2',
            brightWhite: '#ffffff',
        };
    }, []);

    const cleanupRef = useRef<(() => void)[]>([]);

    // Initialize terminal
    useEffect(() => {
        if (!visible || !containerRef.current || termRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineHeight: 1.3,
            letterSpacing: 0,
            theme: getThemeColors(),
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current);
        fitAddon.fit();

        termRef.current = term;
        fitRef.current = fitAddon;

        // Spawn PTY backend
        const spawnTerminal = async () => {
            try {
                const { cols, rows } = fitAddon.proposeDimensions() || { cols: 80, rows: 24 };
                const id = await invoke<number>('spawn_terminal', {
                    rows,
                    cols,
                    cwd: cwd || null,
                });
                idRef.current = id;
                setIsConnected(true);

                // Listen for output events
                const unlisten = await listen<{ id: number; data: string }>(
                    'terminal-output',
                    (event) => {
                        if (event.payload.id === id && termRef.current) {
                            termRef.current.write(event.payload.data);
                        }
                    }
                );
                cleanupRef.current.push(unlisten);

                // Listen for exit
                const unlistenExit = await listen<{ id: number; code: number }>(
                    'terminal-exit',
                    (event) => {
                        if (event.payload.id === id && termRef.current) {
                            termRef.current.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
                            setIsConnected(false);
                        }
                    }
                );
                cleanupRef.current.push(unlistenExit);

                // Send user input to PTY
                term.onData((data) => {
                    if (idRef.current !== null) {
                        invoke('write_terminal', { id: idRef.current, data }).catch(console.error);
                    }
                });

                // Cleanup listeners on dispose - handled in useEffect return
            } catch (err) {
                console.error('Failed to spawn terminal:', err);
                term.write(`\x1b[31mFailed to spawn terminal: ${err}\x1b[0m\r\n`);
            }
        };

        spawnTerminal();

        return () => {
            // Kill PTY session
            if (idRef.current !== null) {
                invoke('kill_terminal', { id: idRef.current }).catch(console.error);
                idRef.current = null;
            }
            // Run cleanup functions
            cleanupRef.current.forEach(fn => fn());
            cleanupRef.current = [];

            term.dispose();
            termRef.current = null;
            fitRef.current = null;
            setIsConnected(false);
        };
    }, [visible, getThemeColors]);

    // Handle resize
    useEffect(() => {
        if (!visible || !fitRef.current) return;

        const handleResize = () => {
            if (fitRef.current && termRef.current) {
                fitRef.current.fit();
                const dims = fitRef.current.proposeDimensions();
                if (dims && idRef.current !== null) {
                    invoke('resize_terminal', {
                        id: idRef.current,
                        rows: dims.rows,
                        cols: dims.cols,
                    }).catch(console.error);
                }
            }
        };

        // Fit on visibility change
        const timer = setTimeout(handleResize, 50);

        // Fit on window resize
        window.addEventListener('resize', handleResize);

        // Also observe the container for size changes (e.g. panel drag)
        const observer = new ResizeObserver(handleResize);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [visible]);

    // Update theme when CSS variables change
    useEffect(() => {
        if (termRef.current) {
            termRef.current.options.theme = getThemeColors();
        }
    });

    if (!visible) return null;

    return (
        <div className="terminal-panel">
            <div className="terminal-panel-header">
                <div className="terminal-panel-title">
                    <span className="terminal-icon">⬛</span>
                    Terminal
                    {isConnected && <span className="terminal-status connected">●</span>}
                </div>
                <div className="terminal-panel-actions">
                    <button
                        className="terminal-btn"
                        onClick={onClose}
                        title="Close terminal (Ctrl+`)"
                    >
                        ✕
                    </button>
                </div>
            </div>
            <div className="terminal-container" ref={containerRef} />
        </div>
    );
}
