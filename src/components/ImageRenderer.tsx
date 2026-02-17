import { useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface ImageRendererProps {
    src: string;
    fileName: string;
}

export default function ImageRenderer({ src, fileName }: ImageRendererProps) {
    const [scale, setScale] = useState(1);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));
    const handleReset = () => setScale(1);

    return (
        <div className="image-preview">
            <div className="image-controls">
                <button onClick={handleZoomOut}><ZoomOut size={16} /></button>
                <button onClick={handleReset}>{Math.round(scale * 100)}%</button>
                <button onClick={handleZoomIn}><ZoomIn size={16} /></button>
            </div>
            <div className="image-container" style={{ overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <img
                    src={src}
                    alt={fileName}
                    style={{
                        transform: `scale(${scale})`,
                        transition: 'transform 0.2s ease',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
                    }}
                />
            </div>
        </div>
    );
}
