import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onSave?: () => void; // Optional save action
    saveLabel?: string;
    dontAskAgain: boolean;
    setDontAskAgain: (value: boolean) => void;
}

export default function ConfirmationModal({
    isOpen,
    onConfirm,
    onCancel,
    onSave,
    saveLabel,
    dontAskAgain,
    setDontAskAgain
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <AlertTriangle size={24} className="modal-icon" />
                    <h3>Unsaved Changes</h3>
                </div>
                <p>You have unsaved changes. What would you like to do?</p>

                <div className="modal-checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={dontAskAgain}
                            onChange={(e) => setDontAskAgain(e.target.checked)}
                        />
                        Don't ask me again (Always Discard)
                    </label>
                </div>

                <div className="modal-actions">
                    <button className="btn-secondary" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="btn-danger" onClick={onConfirm}>
                        Discard
                    </button>
                    {onSave && (
                        <button className="btn-primary" onClick={onSave}>
                            {saveLabel || "Save"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
