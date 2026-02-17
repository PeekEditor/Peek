import { Settings } from '../hooks/useSettings';
import { themes } from '../lib/themes';
import { X, RotateCcw } from 'lucide-react';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onUpdate: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
    onReset: () => void;
}

const SHORTCUTS = [
    { keys: 'Ctrl+S', action: 'Save file' },
    { keys: 'Ctrl+O', action: 'Open file' },
    { keys: 'Ctrl+W', action: 'Close tab' },
    { keys: 'Ctrl+F', action: 'Find & Replace' },
    { keys: 'Ctrl+Z', action: 'Undo' },
    { keys: 'Ctrl+Shift+Z', action: 'Redo' },
    { keys: 'Ctrl+,', action: 'Toggle Settings' },
    { keys: 'Ctrl+P', action: 'Quick Open' },
    { keys: 'Ctrl+P then :', action: 'Jump to Line' },
    { keys: 'Ctrl+P then >', action: 'Run Command' },
    { keys: 'Ctrl+D', action: 'Add Cursor' },
    { keys: 'Ctrl+PageDown', action: 'Next tab' },
    { keys: 'Ctrl+PageUp', action: 'Previous tab' },
];

export default function SettingsPanel({ isOpen, onClose, settings, onUpdate, onReset }: SettingsPanelProps) {
    if (!isOpen) return null;

    return (
        <div className="settings-backdrop" onClick={onClose}>
            <div className="settings-panel" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="icon-btn" onClick={onReset} title="Reset to defaults">
                            <RotateCcw size={14} />
                        </button>
                        <button className="icon-btn" onClick={onClose} title="Close">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="settings-body">
                    {/* ── Theme ───────────────────────────────── */}
                    <div className="settings-section">
                        <h3>Theme</h3>
                        <div className="theme-grid">
                            {themes.map(theme => (
                                <button
                                    key={theme.id}
                                    className={`theme-card ${settings.theme === theme.id ? 'active' : ''}`}
                                    onClick={() => onUpdate('theme', theme.id)}
                                    title={theme.name}
                                >
                                    <div
                                        className="theme-preview"
                                        style={{ background: theme.colors['--bg-color'] }}
                                    >
                                        <div className="theme-preview-lines">
                                            <span style={{ color: theme.colors['--syn-keyword'] }}>fn</span>
                                            <span style={{ color: theme.colors['--syn-function'] }}> main</span>
                                            <span style={{ color: theme.colors['--syn-punctuation'] }}>()</span>
                                            <span style={{ color: theme.colors['--syn-punctuation'] }}> {'{'}</span>
                                        </div>
                                        <div className="theme-preview-lines">
                                            <span style={{ color: theme.colors['--syn-comment'] }}>  // hello</span>
                                        </div>
                                        <div className="theme-preview-lines">
                                            <span style={{ color: theme.colors['--syn-string'] }}>  "text"</span>
                                            <span style={{ color: theme.colors['--syn-number'] }}> 42</span>
                                        </div>
                                    </div>
                                    <span className="theme-name">{theme.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Editor ──────────────────────────────── */}
                    <div className="settings-section">
                        <h3>Editor</h3>

                        <div className="setting-row">
                            <label>Font Size</label>
                            <div className="setting-control">
                                <input
                                    type="range"
                                    min={10} max={24} step={1}
                                    value={settings.fontSize}
                                    onChange={e => onUpdate('fontSize', Number(e.target.value))}
                                />
                                <span className="setting-value">{settings.fontSize}px</span>
                            </div>
                        </div>

                        <div className="setting-row">
                            <label>Tab Size</label>
                            <div className="setting-control">
                                <select
                                    value={settings.tabSize}
                                    onChange={e => onUpdate('tabSize', Number(e.target.value))}
                                >
                                    <option value={2}>2 spaces</option>
                                    <option value={4}>4 spaces</option>
                                    <option value={8}>8 spaces</option>
                                </select>
                            </div>
                        </div>

                        <ToggleRow
                            label="Word Wrap"
                            value={settings.wordWrap}
                            onChange={v => onUpdate('wordWrap', v)}
                        />

                        <ToggleRow
                            label="Show Mini-Map"
                            value={settings.showMiniMap}
                            onChange={v => onUpdate('showMiniMap', v)}
                        />

                        <ToggleRow
                            label="Show Line Numbers"
                            value={settings.showLineNumbers}
                            onChange={v => onUpdate('showLineNumbers', v)}
                        />
                    </div>

                    {/* ── Behavior ────────────────────────────── */}
                    <div className="settings-section">
                        <h3>Behavior</h3>

                        <ToggleRow
                            label="Auto-Save Drafts"
                            value={settings.autoSaveDrafts}
                            onChange={v => onUpdate('autoSaveDrafts', v)}
                        />

                        <ToggleRow
                            label="Confirm Unsaved Changes"
                            value={settings.confirmUnsavedChanges}
                            onChange={v => onUpdate('confirmUnsavedChanges', v)}
                        />
                    </div>

                    {/* ── Shortcuts ───────────────────────────── */}
                    <div className="settings-section">
                        <h3>Keyboard Shortcuts</h3>
                        <table className="shortcuts-table">
                            <tbody>
                                {SHORTCUTS.map(s => (
                                    <tr key={s.keys}>
                                        <td><kbd>{s.keys}</kbd></td>
                                        <td>{s.action}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Toggle Component ──────────────────────────────────────────────────────
function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="setting-row">
            <label>{label}</label>
            <div className="setting-control">
                <button
                    className={`toggle ${value ? 'on' : 'off'}`}
                    onClick={() => onChange(!value)}
                    role="switch"
                    aria-checked={value}
                >
                    <span className="toggle-thumb" />
                </button>
            </div>
        </div>
    );
}
