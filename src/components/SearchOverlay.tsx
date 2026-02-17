import { X, ChevronUp, ChevronDown, RefreshCw, WholeWord } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface SearchOverlayProps {
    onClose: () => void;
    onSearch: (query: string) => void;
    onReplace: (query: string, replaceText: string, replaceAll: boolean) => void;
    onNext: () => void;
    onPrev: () => void;
    matchCount: number;
    currentMatch: number;
}

export default function SearchOverlay({
    onClose,
    onSearch,
    onReplace,
    onNext,
    onPrev,
    matchCount,
    currentMatch
}: SearchOverlayProps) {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) onPrev();
            else onNext();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className="search-overlay">
            <div className="search-row">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Find"
                    className="search-input"
                    onChange={(e) => onSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <div className="search-actions">
                    <span className="match-count">
                        {matchCount > 0 ? `${currentMatch + 1} of ${matchCount}` : 'No results'}
                    </span>
                    <button onClick={onPrev} className="icon-btn-sm" title="Previous (Shift+Enter)">
                        <ChevronUp size={14} />
                    </button>
                    <button onClick={onNext} className="icon-btn-sm" title="Next (Enter)">
                        <ChevronDown size={14} />
                    </button>
                    <button onClick={onClose} className="icon-btn-sm" title="Close (Esc)">
                        <X size={14} />
                    </button>
                </div>
            </div>
            <div className="search-row">
                <input
                    ref={replaceInputRef}
                    type="text"
                    placeholder="Replace"
                    className="search-input"
                />
                <div className="search-actions">
                    <button
                        onClick={() => onReplace(searchInputRef.current?.value || '', replaceInputRef.current?.value || '', false)}
                        className="icon-btn-sm"
                        title="Replace"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={() => onReplace(searchInputRef.current?.value || '', replaceInputRef.current?.value || '', true)}
                        className="icon-btn-sm"
                        title="Replace All"
                    >
                        <WholeWord size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
