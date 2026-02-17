import { useEffect, useState, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import Editor from "./components/CodeEditor";
import MarkdownRenderer from "./components/MarkdownRenderer";
import ImageRenderer from "./components/ImageRenderer";
import BinaryState from "./components/BinaryState";
import ConfirmationModal from "./components/ConfirmationModal";
import ConflictModal from "./components/ConflictModal";
import OmniBar from "./components/OmniBar";
import Toast from "./components/Toast";
import EmptyState from "./components/EmptyState";
import LargeFileViewer from "./components/LargeFileViewer";
import SplitPane from "./components/SplitPane";
import TabBar from "./components/TabBar";
import SettingsPanel from "./components/SettingsPanel";
import TerminalPanel from "./components/TerminalPanel";
import DiffViewer from "./components/DiffViewer";
import { useAutoSave, getAllDrafts } from "./hooks/useAutoSave";
import { useSettings } from "./hooks/useSettings";
import { getThemeById, applyTheme } from "./lib/themes";
import { FileMetadata, getFileType } from "./fileTypes";
import { FolderOpen, Save, Eye, FileText, Columns, AlertTriangle, Settings, TerminalSquare, FileDiff } from "lucide-react";
import "./App.css";

type MarkdownLayout = 'split' | 'edit' | 'preview';

// ── Tab Type ──────────────────────────────────────────────────────────────────
interface TabState {
    id: string;            // filePath used as unique ID
    filePath: string;
    fileData: FileMetadata;
    editContent: string;
    markdownLayout: MarkdownLayout;
}

function App() {
    // ── Multi-Tab State ───────────────────────────────────────────────────
    const [tabs, setTabs] = useState<TabState[]>([]);
    const [activeTabId, setInternalActiveTabId] = useState<string | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [isHovering, setIsHovering] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [showDiff, setShowDiff] = useState(false);
    const [showOmniBar, setShowOmniBar] = useState(false);

    // Settings
    const { settings, updateSetting, resetSettings } = useSettings();

    // Safety & UI State
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<'success' | 'error'>('success');

    const [showModal, setShowModal] = useState(false);
    const [modalConfirmAction, setModalConfirmAction] = useState<() => void>(() => { });
    const [modalSaveAction, setModalSaveAction] = useState<(() => void) | undefined>(undefined);
    const [modalSaveLabel, setModalSaveLabel] = useState("Save");
    const [dontAskAgain, setDontAskAgain] = useState(() => {
        return localStorage.getItem("peek_dont_ask_unsaved") === "true";
    });

    const [showConflictModal, setShowConflictModal] = useState(false);

    // Global Drafts State
    const [availableDrafts, setAvailableDrafts] = useState<string[]>([]);

    // ── Derived State ─────────────────────────────────────────────────────
    const activeTab = tabs.find(t => t.id === activeTabId) || null;
    const fileData = activeTab?.fileData || null;
    const editContent = activeTab?.editContent || "";
    const filePath = activeTab?.filePath || null;
    const markdownLayout = activeTab?.markdownLayout || 'split';

    const isDirty = activeTab ? activeTab.editContent !== activeTab.fileData.content : false;

    // Check if ANY tab is dirty (for window close guard)
    const anyTabDirty = tabs.some(t => t.editContent !== t.fileData.content);

    // Apply theme on change
    useEffect(() => {
        applyTheme(getThemeById(settings.theme));
    }, [settings.theme]);

    // Auto-Save Hook (for active tab)
    const { hasDraft, draftContent, clearDraft } = useAutoSave(filePath, editContent, fileData?.content || "");

    // ── Tab Helpers ───────────────────────────────────────────────────────
    const updateTab = useCallback((tabId: string, updates: Partial<TabState>) => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
    }, []);

    const setEditContent = useCallback((content: string) => {
        if (activeTabId) {
            updateTab(activeTabId, { editContent: content });
        }
    }, [activeTabId, updateTab]);

    const setMarkdownLayout = useCallback((layout: MarkdownLayout) => {
        if (activeTabId) {
            updateTab(activeTabId, { markdownLayout: layout });
        }
    }, [activeTabId, updateTab]);

    // ── Notifications ─────────────────────────────────────────────────────
    const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
        setToastMessage(msg);
        setToastType(type);
        setShowToast(true);
    };

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = useCallback(async (force = false) => {
        if (!activeTab) return false;

        // Handle MouseEvent or standard call
        const isForce = typeof force === 'boolean' ? force : false;

        try {
            if (!isForce) {
                try {
                    const meta = await invoke<FileMetadata>("read_file_content", { path: activeTab.filePath });
                    if (meta.mtime > activeTab.fileData.mtime) {
                        setShowConflictModal(true);
                        return false;
                    }
                } catch (e) {
                    console.warn("Could not check mtime, proceeding with save attempt", e);
                }
            }

            await invoke("safe_save_file", { path: activeTab.filePath, content: activeTab.editContent });

            // Sync new mtime
            try {
                const newMeta = await invoke<FileMetadata>("read_file_content", { path: activeTab.filePath });
                updateTab(activeTab.id, {
                    fileData: { ...activeTab.fileData, content: activeTab.editContent, mtime: newMeta.mtime }
                });
            } catch (e) {
                updateTab(activeTab.id, {
                    fileData: { ...activeTab.fileData, content: activeTab.editContent }
                });
            }

            clearDraft();
            showNotification("File saved successfully");
            setAvailableDrafts(getAllDrafts());
            return true;
        } catch (err) {
            console.error("Failed to save:", err);
            showNotification("Failed to save file", "error");
            return false;
        }
    }, [activeTab, clearDraft, updateTab]);

    const handleOverwrite = async () => {
        setShowConflictModal(false);
        await handleSave(true);
    };

    const handleReload = async () => {
        if (!activeTab || !activeTab.filePath) return;
        setShowConflictModal(false);
        await loadFile(activeTab.filePath);
        showNotification("File reloaded from disk");
    };

    // ── Safety Guard ──────────────────────────────────────────────────────
    const stateRef = useRef({ isDirty: anyTabDirty, dontAskAgain, handleSave, hasDraft });
    useEffect(() => {
        stateRef.current = { isDirty: anyTabDirty, dontAskAgain, handleSave, hasDraft };
    }, [anyTabDirty, dontAskAgain, handleSave, hasDraft]);

    const unlistenCloseRef = useRef<(() => void) | null>(null);
    const isExitingRef = useRef(false);

    const handleActionWithSafety = (action: () => void) => {
        if (isDirty && !dontAskAgain && settings.confirmUnsavedChanges) {
            setModalConfirmAction(() => action);
            setModalSaveLabel("Save");
            setModalSaveAction(() => async () => {
                const success = await handleSave();
                if (success) {
                    setShowModal(false);
                    action();
                }
            });
            setShowModal(true);
        } else {
            action();
        }
    };

    const confirmDiscard = () => {
        setShowModal(false);
        if (dontAskAgain) {
            localStorage.setItem("peek_dont_ask_unsaved", "true");
        }
        modalConfirmAction();
    };

    // ── Window Close ──────────────────────────────────────────────────────
    useEffect(() => {
        const setupListener = async () => {
            if (unlistenCloseRef.current) {
                unlistenCloseRef.current();
                unlistenCloseRef.current = null;
            }

            const unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
                const { isDirty, dontAskAgain, handleSave } = stateRef.current;

                if (isExitingRef.current) return;

                if (isDirty && !dontAskAgain) {
                    event.preventDefault();

                    setModalConfirmAction(() => () => {
                        isExitingRef.current = true;
                        if (unlistenCloseRef.current) {
                            unlistenCloseRef.current();
                            unlistenCloseRef.current = null;
                        }
                        getCurrentWindow().close();
                    });

                    setModalSaveLabel("Save & Close");
                    setModalSaveAction(() => async () => {
                        const success = await handleSave();
                        if (success) {
                            isExitingRef.current = true;
                            if (unlistenCloseRef.current) {
                                unlistenCloseRef.current();
                                unlistenCloseRef.current = null;
                            }
                            getCurrentWindow().close();
                        }
                    });

                    setShowModal(true);
                }
            });
            unlistenCloseRef.current = unlisten;
        };

        setupListener();
        setAvailableDrafts(getAllDrafts());

        return () => {
            if (unlistenCloseRef.current) {
                unlistenCloseRef.current();
            }
        };
    }, []);

    // ── Drag & Drop ───────────────────────────────────────────────────────
    useEffect(() => {
        const unlistenDrop = listen("tauri://drag-drop", async (event: any) => {
            setIsHovering(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
                // Open each dropped file as a new tab
                for (const path of paths) {
                    loadFile(path);
                }
            }
        });

        const unlistenDragEnter = listen("tauri://drag-enter", () => setIsHovering(true));
        const unlistenDragLeave = listen("tauri://drag-leave", () => setIsHovering(false));

        getCurrentWindow().show();

        return () => {
            unlistenDrop.then(f => f());
            unlistenDragEnter.then(f => f());
            unlistenDragLeave.then(f => f());
        };
    }, []);

    const handleActionRef = useRef(handleActionWithSafety);
    useEffect(() => { handleActionRef.current = handleActionWithSafety; }, [handleActionWithSafety]);

    // ── Load File (Open Tab) ──────────────────────────────────────────────
    const loadFile = async (path: string, autoRestore: boolean = false) => {
        const existingIdx = tabs.findIndex(t => t.filePath === path);

        try {
            setError(null);
            const data = await invoke<FileMetadata>("read_file_content", { path });

            let contentToUse = data.content;
            let newFileData = data;

            if (autoRestore) {
                const savedDraft = localStorage.getItem(`peek_draft_${path}`);
                if (savedDraft) {
                    try {
                        await invoke("write_file_content", { path, content: savedDraft });
                        contentToUse = savedDraft;
                        newFileData = { ...data, content: savedDraft };
                        localStorage.removeItem(`peek_draft_${path}`);
                        showNotification("Draft restored and saved to file");
                    } catch (saveErr) {
                        console.error("Failed to save restored draft:", saveErr);
                        showNotification("Failed to save restored draft to disk", "error");
                        contentToUse = savedDraft;
                    }
                }
            }

            const newTab: TabState = {
                id: path,
                filePath: path,
                fileData: newFileData,
                editContent: contentToUse,
                markdownLayout: 'split',
            };

            if (existingIdx !== -1) {
                // Update existing tab
                setTabs(prev => prev.map(t => t.id === path ? newTab : t));
            } else {
                setTabs(prev => [...prev, newTab]);
            }
            setActiveTabId(path);
            setAvailableDrafts(getAllDrafts());
        } catch (err) {
            console.error("Failed to read file:", err);
            setError(String(err));
        }
    };

    // ── Open Dialog ───────────────────────────────────────────────────────
    const handleOpen = () => {
        const doOpen = async () => {
            try {
                const selected = await open({
                    multiple: true,
                    directory: false,
                });
                if (selected) {
                    const paths = Array.isArray(selected) ? selected : [selected];
                    for (const p of paths) {
                        await loadFile(p as string);
                    }
                }
            } catch (err) {
                console.error("Failed to open file dialog:", err);
            }
        };
        doOpen();
    };

    // ── Close Tab ─────────────────────────────────────────────────────────
    const setActiveTabId = (id: string | null) => {
        setInternalActiveTabId(id);
        setShowDiff(false); // Reset diff view when switching tabs
    };
    const closeTab = (tabId: string) => {
        const tab = tabs.find(t => t.id === tabId);
        if (!tab) return;

        const tabIsDirty = tab.editContent !== tab.fileData.content;

        const doClose = () => {
            localStorage.removeItem(`peek_draft_${tab.filePath}`);
            setAvailableDrafts(getAllDrafts());

            setTabs(prev => {
                const newTabs = prev.filter(t => t.id !== tabId);
                if (activeTabId === tabId) {
                    const idx = prev.findIndex(t => t.id === tabId);
                    if (newTabs.length > 0) {
                        const newIdx = Math.min(idx, newTabs.length - 1);
                        setActiveTabId(newTabs[newIdx].id);
                    } else {
                        setActiveTabId(null);
                    }
                }
                return newTabs;
            });
        };

        if (tabIsDirty && !dontAskAgain) {
            setActiveTabId(tabId);
            setModalConfirmAction(() => doClose);
            setModalSaveLabel("Save");
            setModalSaveAction(() => async () => {
                try {
                    await invoke("write_file_content", { path: tab.filePath, content: tab.editContent });
                    showNotification("File saved successfully");
                } catch (err) {
                    showNotification("Failed to save file", "error");
                    return;
                }
                setShowModal(false);
                doClose();
            });
            setShowModal(true);
        } else {
            doClose();
        }
    };

    // ── Draft Recovery ────────────────────────────────────────────────────
    const restoreDraft = () => {
        if (!filePath || !draftContent) return;
        const newContent = draftContent;
        setEditContent(newContent);

        invoke("write_file_content", { path: filePath, content: newContent })
            .then(() => {
                if (activeTabId) {
                    updateTab(activeTabId, {
                        fileData: { ...fileData!, content: newContent },
                        editContent: newContent
                    });
                }
                clearDraft();
                showNotification("Draft restored and saved");
            })
            .catch(() => showNotification("Failed to save restored draft", "error"));
    };

    const discardDraft = () => {
        clearDraft();
        if (activeTab) {
            updateTab(activeTab.id, { editContent: activeTab.fileData.content });
        }
        showNotification("Draft discarded");
    };

    const handleGlobalDiscard = (path: string) => {
        localStorage.removeItem(`peek_draft_${path}`);
        setAvailableDrafts(prev => prev.filter(p => p !== path));
        showNotification("Draft discarded");
    };

    // ── OmniBar Handlers ──────────────────────────────────────────────────
    const handleJumpToLine = (line: number) => {
        window.dispatchEvent(new CustomEvent('peek:jump-to-line', { detail: { line } }));
    };

    const handleRunCommand = (command: string) => {
        switch (command) {
            case 'toggle_terminal': setShowTerminal(prev => !prev); break;
            case 'toggle_theme':
                const newTheme = settings.theme === 'midnight' ? 'dawn' : 'midnight';
                updateSetting('theme', newTheme);
                break;
            case 'save_file': handleSave(); break;
            case 'close_tab': if (activeTabId) closeTab(activeTabId); break;
        }
    };

    // ── Keyboard Shortcuts ────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                setShowOmniBar(true);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                handleOpen();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                e.preventDefault();
                if (activeTabId) closeTab(activeTabId);
            }
            if (e.ctrlKey && (e.key === 'PageDown' || e.key === 'PageUp')) {
                e.preventDefault();
                if (tabs.length <= 1) return;
                const idx = tabs.findIndex(t => t.id === activeTabId);
                const nextIdx = e.key === 'PageUp'
                    ? (idx - 1 + tabs.length) % tabs.length
                    : (idx + 1) % tabs.length;
                setActiveTabId(tabs[nextIdx].id);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                setShowSettings(prev => !prev);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault();
                setShowTerminal(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave, tabs, activeTabId, handleOpen, closeTab]);

    // ── Render Content ────────────────────────────────────────────────────
    const renderContent = () => {
        if (error) return <div className="error-state"><h3>Error</h3><p>{error}</p></div>;

        if (showDiff && isDirty && fileData) {
            return <DiffViewer
                original={fileData.content}
                modified={editContent}
                onClose={() => setShowDiff(false)}
            />;
        }

        if (!fileData) return <EmptyState
            drafts={availableDrafts}
            onRecover={(path) => loadFile(path, true)}
            onDiscard={handleGlobalDiscard}
        />;

        if (fileData.is_binary) return <BinaryState fileName={fileData.file_name} />;
        if (fileData.is_large_file) return <LargeFileViewer filePath={filePath!} fileSize={fileData.size} />;

        const type = getFileType(fileData.extension);

        if (type === 'markdown') {
            return (
                <div style={{ height: '100%', width: '100%' }}>
                    {markdownLayout === 'split' && (
                        <SplitPane
                            left={<Editor content={editContent} onChange={setEditContent} onSave={handleSave} settings={settings} fileExtension={fileData?.extension || ''} filePath={filePath!} />}
                            right={<MarkdownRenderer content={editContent} />}
                        />
                    )}
                    {markdownLayout === 'edit' && (
                        <Editor content={editContent} onChange={setEditContent} onSave={handleSave} settings={settings} fileExtension={fileData?.extension || ''} filePath={filePath!} />
                    )}
                    {markdownLayout === 'preview' && (
                        <div className="markdown-preview" style={{ overflow: 'auto', height: '100%' }}><MarkdownRenderer content={editContent} /></div>
                    )}
                </div>
            );
        }

        if (type === 'image') {
            return <ImageRenderer src={fileData.content} fileName={fileData.file_name} />;
        }

        return <Editor content={editContent} onChange={setEditContent} onSave={handleSave} settings={settings} fileExtension={fileData?.extension || ''} filePath={filePath!} />;
    };

    const isEditable = fileData && !fileData.is_binary && !fileData.is_large_file && getFileType(fileData.extension) !== 'image';
    const isMarkdown = fileData && getFileType(fileData.extension) === 'markdown';

    const tabBarData = tabs.map(t => ({
        id: t.id,
        filePath: t.filePath,
        fileName: t.fileData.file_name,
        isDirty: t.editContent !== t.fileData.content,
    }));

    return (
        <div className={`app-container ${isHovering ? 'drag-hover' : ''}`}>

            {hasDraft && (
                <div className="draft-banner">
                    <div className="draft-info">
                        <AlertTriangle size={14} className="draft-icon" />
                        <span>Unsaved draft found from previous session.</span>
                    </div>
                    <div className="draft-actions">
                        <button className="btn-xs btn-primary" onClick={restoreDraft}>Restore</button>
                        <button className="btn-xs" onClick={discardDraft}>Discard</button>
                    </div>
                </div>
            )}

            <TabBar
                tabs={tabBarData}
                activeTabId={activeTabId}
                onSelect={setActiveTabId}
                onClose={closeTab}
            />

            {fileData && (
                <div className="toolbar">
                    <div className="toolbar-info">{fileData.file_name} {isDirty && <span className="dirty-indicator">•</span>}</div>
                    <div className="toolbar-buttons">
                        {isMarkdown && (
                            <div className="button-group" style={{ display: 'flex', gap: '4px', marginRight: '12px', borderRight: '1px solid var(--border-color)', paddingRight: '12px' }}>
                                <button
                                    className={`icon-btn ${markdownLayout === 'split' ? 'active' : ''}`}
                                    onClick={() => setMarkdownLayout('split')}
                                    title="Split View"
                                >
                                    <Columns size={16} />
                                </button>
                                <button
                                    className={`icon-btn ${markdownLayout === 'edit' ? 'active' : ''}`}
                                    onClick={() => setMarkdownLayout('edit')}
                                    title="Edit Only"
                                >
                                    <FileText size={16} />
                                </button>
                                <button
                                    className={`icon-btn ${markdownLayout === 'preview' ? 'active' : ''}`}
                                    onClick={() => setMarkdownLayout('preview')}
                                    title="Preview Only"
                                >
                                    <Eye size={16} />
                                </button>
                            </div>
                        )}

                        {isDirty && (
                            <button
                                className={`icon-btn ${showDiff ? 'active' : ''}`}
                                onClick={() => setShowDiff(prev => !prev)}
                                title="Compare with Saved"
                                style={{ color: showDiff ? 'var(--syn-keyword)' : undefined }}
                            >
                                <FileDiff size={16} />
                            </button>
                        )}

                        <button className="icon-btn" onClick={handleOpen} title="Open File (Ctrl+O)">
                            <FolderOpen size={16} />
                        </button>

                        {isEditable && (
                            <button className="icon-btn" onClick={() => handleSave()} title="Save (Ctrl+S)">
                                <Save size={16} />
                            </button>
                        )}

                        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings (Ctrl+,)">
                            <Settings size={16} />
                        </button>
                        <button className={`icon-btn ${showTerminal ? 'active' : ''}`} onClick={() => setShowTerminal(prev => !prev)} title="Terminal (Ctrl+`)">
                            <TerminalSquare size={16} />
                        </button>
                    </div>
                </div>
            )}
            {!fileData && (
                <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
                    <button className="icon-btn" onClick={handleOpen} title="Open File (Ctrl+O)">
                        <FolderOpen size={16} />
                    </button>
                    <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings (Ctrl+,)">
                        <Settings size={16} />
                    </button>
                </div>
            )}
            <div className="content-area">
                {renderContent()}
            </div>

            <TerminalPanel
                visible={showTerminal}
                onClose={() => setShowTerminal(false)}
                cwd={filePath ? (() => {
                    const lastSlash = filePath.lastIndexOf('/');
                    const lastBackslash = filePath.lastIndexOf('\\');
                    const sep = Math.max(lastSlash, lastBackslash);
                    return sep > -1 ? filePath.substring(0, sep) : null;
                })() : null}
            />

            {showToast && (
                <Toast
                    message={toastMessage}
                    type={toastType}
                    onClose={() => setShowToast(false)}
                />
            )}

            <ConfirmationModal
                isOpen={showModal}
                onConfirm={confirmDiscard}
                onCancel={() => setShowModal(false)}
                onSave={modalSaveAction}
                saveLabel={modalSaveLabel}
                dontAskAgain={dontAskAgain}
                setDontAskAgain={setDontAskAgain}
            />

            <ConflictModal
                isOpen={showConflictModal}
                fileName={fileData?.file_name || 'Unknown'}
                onOverwrite={handleOverwrite}
                onReload={handleReload}
                onCancel={() => setShowConflictModal(false)}
            />

            <OmniBar
                isOpen={showOmniBar}
                onClose={() => setShowOmniBar(false)}
                tabs={tabBarData}
                onSelectFile={(path) => loadFile(path)}
                onJumpToLine={handleJumpToLine}
                onRunCommand={handleRunCommand}
            />

            <SettingsPanel
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                settings={settings}
                onUpdate={updateSetting}
                onReset={resetSettings}
            />
        </div>
    );
}

export default App;
