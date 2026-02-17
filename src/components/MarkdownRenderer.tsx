import { useEffect, useState, useRef, useCallback } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/vs2015.css'; // Or any other style

interface MarkdownRendererProps {
    content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
    const [html, setHtml] = useState<string>('');
    const latestIdRef = useRef<string>('');
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize the worker
        workerRef.current = new Worker(new URL('../worker.ts', import.meta.url), {
            type: 'module'
        });

        workerRef.current.onmessage = (e: MessageEvent) => {
            const { type, id, html } = e.data;
            if (type === 'PARSE_MARKDOWN_RESULT' && id === latestIdRef.current) {
                // Sanitize in MAIN thread because DOMPurify needs DOM
                const sanitized = DOMPurify.sanitize(html);
                setHtml(sanitized);
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    useEffect(() => {
        const id = Date.now().toString() + Math.random().toString();
        latestIdRef.current = id;
        workerRef.current?.postMessage({ type: 'PARSE_MARKDOWN', content, id });
    }, [content]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest('a');
        if (anchor) {
            e.preventDefault();
            const href = anchor.getAttribute('href');
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                openUrl(href);
            }
        }
    }, []);

    return (
        <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={handleClick}
        />
    );
}
