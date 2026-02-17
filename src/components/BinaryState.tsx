import { Lock } from 'lucide-react';

interface BinaryStateProps {
    fileName: string;
}

export default function BinaryState({ fileName }: BinaryStateProps) {
    return (
        <div className="empty-state">
            <div className="empty-content">
                <div className="icon-stack">
                    <Lock size={48} className="icon-primary" />
                </div>
                <h2>Binary File Detected</h2>
                <p>
                    <strong>{fileName}</strong> appears to be a binary file.
                    <br />
                    Preview is not available for this file type.
                </p>
                <div className="supported-formats">
                    <span>Use an external viewer</span>
                </div>
            </div>
        </div>
    );
}
