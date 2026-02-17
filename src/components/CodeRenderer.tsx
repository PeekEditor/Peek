import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { getLanguage } from '../fileTypes';

interface CodeRendererProps {
    content: string;
    extension: string;
}

export default function CodeRenderer({ content, extension }: CodeRendererProps) {
    const language = getLanguage(extension);

    return (
        <div className="code-preview">
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                showLineNumbers={true}
                customStyle={{
                    background: 'transparent',
                    margin: 0,
                    padding: '1.5rem',
                    fontSize: '14px',
                    lineHeight: '1.5'
                }}
            >
                {content}
            </SyntaxHighlighter>
        </div>
    );
}
