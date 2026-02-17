import { ReactNode } from 'react';

interface SplitPaneProps {
    left: ReactNode;
    right: ReactNode;
}

export default function SplitPane({ left, right }: SplitPaneProps) {
    return (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div style={{ width: '50%', height: '100%', overflow: 'hidden', borderRight: '1px solid var(--border-color)' }}>
                {left}
            </div>
            <div style={{ width: '50%', height: '100%', overflow: 'auto', background: 'var(--bg-secondary)' }}>
                {right}
            </div>
        </div>
    );
}
