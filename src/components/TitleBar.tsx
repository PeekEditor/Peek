import { X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
    fileName?: string;
}

export default function TitleBar({ fileName }: TitleBarProps) {
    const appWindow = getCurrentWindow();

    const handleClose = () => {
        appWindow.close();
    };

    return (
        <div className="titlebar">
            <div className="title-content" data-tauri-drag-region>
                <div className="title-text" data-tauri-drag-region>
                    {fileName || "Peek"}
                </div>
            </div>
            <button className="titlebar-button close" onClick={handleClose}>
                <X size={14} />
            </button>
        </div>
    );
}
