import { useMemo } from 'react';
import * as diff from 'diff';

interface DiffViewerProps {
    original: string;
    modified: string;
    onClose: () => void;
}

export default function DiffViewer({ original, modified, onClose }: DiffViewerProps) {
    const diffs = useMemo(() => {
        return diff.diffLines(original, modified);
    }, [original, modified]);

    return (
        <div className="diff-viewer">
            <div className="diff-header">
                <div className="diff-title">
                    <span className="diff-legend-item add">Added</span>
                    <span className="diff-legend-item del">Removed</span>
                </div>
                <div className="diff-actions">
                    <button onClick={onClose} className="btn-secondary btn-sm">Back to Editor</button>
                </div>
            </div>
            <div className="diff-scroll-container">
                <div className="diff-content">
                    {diffs.map((part, i) => {
                        const type = part.added ? 'add' : part.removed ? 'del' : 'neutral';
                        // Split into lines. diffLines includes newlines.
                        let lines = part.value.split('\n');
                        // If the last element is empty (because value ended with \n), drop it
                        // unless the value was JUST check for empty string? split('') gives [''].
                        if (lines.length > 0 && lines[lines.length - 1] === '') {
                            lines.pop();
                        }

                        return lines.map((line, j) => (
                            <div key={`${i}-${j}`} className={`diff-line diff-${type}`}>
                                <div className="diff-gutter">
                                    {type === 'add' ? '+' : type === 'del' ? '-' : ''}
                                </div>
                                <div className="diff-code">{line}</div>
                            </div>
                        ));
                    })}
                </div>
            </div>
        </div>
    );
}
