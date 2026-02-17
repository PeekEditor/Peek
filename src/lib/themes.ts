export interface Theme {
    id: string;
    name: string;
    colors: Record<string, string>;
}

const midnight: Theme = {
    id: 'midnight',
    name: 'Midnight',
    colors: {
        '--bg-color': '#0f0f0f',
        '--bg-darker': '#0a0a0a',
        '--bg-glass': 'rgba(15, 15, 15, 0.85)',
        '--bg-hover': 'rgba(255, 255, 255, 0.05)',
        '--text-color': '#e0e0e0',
        '--text-dim': '#a0a0a0',
        '--accent-color': '#3b82f6',
        '--border-color': 'rgba(255, 255, 255, 0.08)',
        // Syntax
        '--syn-keyword': '#c678dd',
        '--syn-string': '#98c379',
        '--syn-number': '#d19a66',
        '--syn-comment': '#5c6370',
        '--syn-function': '#61afef',
        '--syn-variable': '#e06c75',
        '--syn-type': '#e5c07b',
        '--syn-operator': '#56b6c2',
        '--syn-punctuation': '#7c8da4',
        '--syn-property': '#ef596f',
        '--syn-tag': '#e06c75',
        '--syn-attr': '#e5c07b',
        '--syn-builtin': '#61afef',
    },
};

const dracula: Theme = {
    id: 'dracula',
    name: 'Dracula',
    colors: {
        '--bg-color': '#282a36',
        '--bg-darker': '#21222c',
        '--bg-glass': 'rgba(40, 42, 54, 0.85)',
        '--bg-hover': 'rgba(255, 255, 255, 0.06)',
        '--text-color': '#f8f8f2',
        '--text-dim': '#6272a4',
        '--accent-color': '#bd93f9',
        '--border-color': 'rgba(255, 255, 255, 0.1)',
        '--syn-keyword': '#ff79c6',
        '--syn-string': '#f1fa8c',
        '--syn-number': '#bd93f9',
        '--syn-comment': '#6272a4',
        '--syn-function': '#50fa7b',
        '--syn-variable': '#f8f8f2',
        '--syn-type': '#8be9fd',
        '--syn-operator': '#ff79c6',
        '--syn-punctuation': '#f8f8f2',
        '--syn-property': '#66d9ef',
        '--syn-tag': '#ff79c6',
        '--syn-attr': '#50fa7b',
        '--syn-builtin': '#8be9fd',
    },
};

const nord: Theme = {
    id: 'nord',
    name: 'Nord',
    colors: {
        '--bg-color': '#2e3440',
        '--bg-darker': '#272c36',
        '--bg-glass': 'rgba(46, 52, 64, 0.85)',
        '--bg-hover': 'rgba(255, 255, 255, 0.04)',
        '--text-color': '#d8dee9',
        '--text-dim': '#616e88',
        '--accent-color': '#88c0d0',
        '--border-color': 'rgba(255, 255, 255, 0.08)',
        '--syn-keyword': '#81a1c1',
        '--syn-string': '#a3be8c',
        '--syn-number': '#b48ead',
        '--syn-comment': '#616e88',
        '--syn-function': '#88c0d0',
        '--syn-variable': '#d8dee9',
        '--syn-type': '#8fbcbb',
        '--syn-operator': '#81a1c1',
        '--syn-punctuation': '#eceff4',
        '--syn-property': '#88c0d0',
        '--syn-tag': '#81a1c1',
        '--syn-attr': '#8fbcbb',
        '--syn-builtin': '#5e81ac',
    },
};

const solarizedDark: Theme = {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    colors: {
        '--bg-color': '#002b36',
        '--bg-darker': '#00212b',
        '--bg-glass': 'rgba(0, 43, 54, 0.85)',
        '--bg-hover': 'rgba(255, 255, 255, 0.04)',
        '--text-color': '#839496',
        '--text-dim': '#586e75',
        '--accent-color': '#268bd2',
        '--border-color': 'rgba(255, 255, 255, 0.08)',
        '--syn-keyword': '#859900',
        '--syn-string': '#2aa198',
        '--syn-number': '#d33682',
        '--syn-comment': '#586e75',
        '--syn-function': '#268bd2',
        '--syn-variable': '#b58900',
        '--syn-type': '#cb4b16',
        '--syn-operator': '#859900',
        '--syn-punctuation': '#839496',
        '--syn-property': '#268bd2',
        '--syn-tag': '#268bd2',
        '--syn-attr': '#b58900',
        '--syn-builtin': '#6c71c4',
    },
};

const githubLight: Theme = {
    id: 'github-light',
    name: 'GitHub Light',
    colors: {
        '--bg-color': '#ffffff',
        '--bg-darker': '#f6f8fa',
        '--bg-glass': 'rgba(255, 255, 255, 0.9)',
        '--bg-hover': 'rgba(0, 0, 0, 0.04)',
        '--text-color': '#24292f',
        '--text-dim': '#656d76',
        '--accent-color': '#0969da',
        '--border-color': 'rgba(0, 0, 0, 0.1)',
        '--syn-keyword': '#cf222e',
        '--syn-string': '#0a3069',
        '--syn-number': '#0550ae',
        '--syn-comment': '#6e7781',
        '--syn-function': '#8250df',
        '--syn-variable': '#953800',
        '--syn-type': '#0550ae',
        '--syn-operator': '#cf222e',
        '--syn-punctuation': '#24292f',
        '--syn-property': '#0550ae',
        '--syn-tag': '#116329',
        '--syn-attr': '#0550ae',
        '--syn-builtin': '#8250df',
    },
};

export const themes: Theme[] = [midnight, dracula, nord, solarizedDark, githubLight];

export function getThemeById(id: string): Theme {
    return themes.find(t => t.id === id) || midnight;
}

export function applyTheme(theme: Theme) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.colors)) {
        root.style.setProperty(key, value);
    }
}
