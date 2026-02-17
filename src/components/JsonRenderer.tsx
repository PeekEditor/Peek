import CodeRenderer from './CodeRenderer';

interface JsonRendererProps {
    content: string;
}

export default function JsonRenderer({ content }: JsonRendererProps) {
    let formatted = content;
    try {
        const obj = JSON.parse(content);
        formatted = JSON.stringify(obj, null, 2);
    } catch (e) {
        // If invalid JSON, just show as is
    }

    return <CodeRenderer content={formatted} extension="json" />;
}
