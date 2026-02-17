import { AlertTriangle } from 'lucide-react';

interface ConflictModalProps {
    isOpen: boolean;
    fileName: string;
    onOverwrite: () => void;
    onReload: () => void;
    onCancel: () => void;
}

export default function ConflictModal({ isOpen, fileName, onOverwrite, onReload, onCancel }: ConflictModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <AlertTriangle size={24} className="text-warning" style={{ marginRight: '12px' }} />
                    <h2>File Changed on Disk</h2>
                </div>
                <div className="modal-body">
                    <p>The file <strong>{fileName}</strong> has been modified by another program.</p>
                    <p>Do you want to overwrite the disk version with your changes, or reload the file from disk (losing your changes)?</p>
                </div>
                <div className="modal-actions">
                    <button className="btn" onClick={onReload}>Reload from Disk</button>
                    <div style={{ flex: 1 }}></div>
                    <button className="btn" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-danger" onClick={onOverwrite}>Overwrite</button>
                </div>
            </div>
        </div>
    );
}
