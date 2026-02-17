import { marked } from 'marked';
import hljs from 'highlight.js';

// Configure marked with highlight.js using a custom renderer
const renderer = new marked.Renderer();

renderer.code = function (tokens) {
    const { text, lang } = tokens;
    // Check if language is valid
    const language = hljs.getLanguage(lang || '') ? lang : 'plaintext';

    let highlighted;
    try {
        if (language && language !== 'plaintext') {
            highlighted = hljs.highlight(text, { language: language! }).value;
        } else {
            highlighted = hljs.highlightAuto(text).value;
        }
    } catch (e) {
        highlighted = text;
    }

    // We can manually wrap it or call the original renderer, 
    // but the original renderer expects the code to be escaped if we don't highlight it?
    // Actually marked expects us to return the HTML string for the code block.

    const escapedLang = (lang || 'plaintext').replace(/"/g, '&quot;');

    return `<pre><code class="hljs language-${escapedLang}">${highlighted}</code></pre>`;
};

marked.use({ renderer });

// Worker Message Types
type WorkerMessage =
    | { type: 'PARSE_MARKDOWN'; content: string; id: string }
    | { type: 'HIGHLIGHT_CODE'; content: string; language: string; id: string };

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type, id } = e.data;

    try {
        if (type === 'PARSE_MARKDOWN') {
            const html = await marked.parse(e.data.content);
            self.postMessage({ type: 'PARSE_MARKDOWN_RESULT', id, html });
        }
        else if (type === 'HIGHLIGHT_CODE') {
            const { content, language } = e.data;
            let highlighted = '';

            if (language && hljs.getLanguage(language)) {
                highlighted = hljs.highlight(content, { language, ignoreIllegals: true }).value;
            } else {
                const auto = hljs.highlightAuto(content);
                highlighted = auto.value;
            }

            self.postMessage({ type: 'HIGHLIGHT_CODE_RESULT', id, html: highlighted });
        }
    } catch (err) {
        console.error('Worker error:', err);
        self.postMessage({ type: 'ERROR', id, error: String(err) });
    }
};
