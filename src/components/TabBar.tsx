import { X } from 'lucide-react';

interface Tab {
    id: string;
    filePath: string;
    fileName: string;
    isDirty: boolean;
}

interface TabBarProps {
    tabs: Tab[];
    activeTabId: string | null;
    onSelect: (tabId: string) => void;
    onClose: (tabId: string) => void;
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose }: TabBarProps) {
    if (tabs.length === 0) return null;

    return (
        <div className="tab-bar">
            {tabs.map(tab => (
                <div
                    key={tab.id}
                    className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                    onClick={() => onSelect(tab.id)}
                    onMouseDown={(e) => {
                        // Middle-click to close
                        if (e.button === 1) {
                            e.preventDefault();
                            onClose(tab.id);
                        }
                    }}
                    title={tab.filePath}
                >
                    <span className="tab-name">
                        {tab.fileName}
                        {tab.isDirty && <span className="tab-dirty">•</span>}
                    </span>
                    <button
                        className="tab-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose(tab.id);
                        }}
                        title="Close"
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
}

export type { Tab };
