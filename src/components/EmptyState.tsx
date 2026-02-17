import { RotateCcw, Trash2 } from 'lucide-react';

interface EmptyStateProps {
    drafts?: string[];
    onRecover?: (path: string) => void;
    onDiscard?: (path: string) => void;
}

export default function EmptyState({ drafts = [], onRecover, onDiscard }: EmptyStateProps) {
    return (
        <div className="empty-state">
            <div className="empty-content">
                <div className="icon-stack">
                    <img src="/logo.png" alt="Peek" className="peek-logo" />
                </div>
                <h2>Ready to Peek</h2>
                <p>Drag and drop a file anywhere to preview</p>

                {drafts.length > 0 && (
                    <div className="draft-list-container">
                        <h3>Recover Unsaved Drafts</h3>
                        <ul className="draft-list">
                            {drafts.map(path => (
                                <li key={path} className="draft-item">
                                    <span className="draft-path" title={path}>{path.split('/').pop()}</span>
                                    <div className="draft-actions">
                                        <button
                                            className="btn-xs btn-primary recover-btn"
                                            onClick={() => onRecover?.(path)}
                                            title={`Recover ${path}`}
                                        >
                                            <RotateCcw size={12} /> Recover
                                        </button>
                                        <button
                                            className="btn-xs btn-danger discard-btn"
                                            onClick={() => onDiscard?.(path)}
                                            title={`Discard ${path}`}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="supported-formats">
                    <span>Markdown</span>
                    <span>Code</span>
                    <span>JSON</span>
                    <span>Images</span>
                </div>
            </div>
        </div>
    );
}
