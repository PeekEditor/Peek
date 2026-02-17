export type FileType = 'markdown' | 'code' | 'json' | 'image' | 'unknown';

export interface FileMetadata {
    content: string;
    file_name: string;
    extension: string;
    size: number;
    mtime: number;
    is_binary: boolean;
    is_large_file: boolean;
}

export const getFileType = (extension: string): FileType => {
    const ext = extension.toLowerCase();

    if (ext === 'md' || ext === 'markdown') return 'markdown';
    if (ext === 'json') return 'json';
    if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) return 'image';

    // List of common code extensions
    const codeExtensions = [
        'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'c', 'cpp', 'h', 'hpp',
        'java', 'kt', 'swift', 'php', 'html', 'css', 'scss', 'less', 'sql', 'sh',
        'bash', 'zsh', 'yaml', 'yml', 'xml', 'toml', 'ini', 'conf', 'dockerfile',
        'lua', 'pl', 'pm', 'r', 'dart', 'elm', 'erl', 'ex', 'exs', 'fs', 'fsx',
        'hs', 'lhs', 'jl', 'm', 'mm', 'ml', 'mli', 'scala', 'v', 'vim'
    ];

    if (codeExtensions.includes(ext)) return 'code';

    // Default to code for unknown text files if not binary
    return 'code';
};

export const getLanguage = (extension: string): string => {
    const ext = extension.toLowerCase();
    const map: Record<string, string> = {
        'js': 'javascript', 'jsx': 'jsx',
        'ts': 'typescript', 'tsx': 'tsx',
        'py': 'python',
        'rb': 'ruby',
        'rs': 'rust',
        'go': 'go',
        'c': 'c', 'cpp': 'cpp', 'h': 'cpp', 'hpp': 'cpp',
        'java': 'java',
        'kt': 'kotlin',
        'swift': 'swift',
        'php': 'php',
        'html': 'html',
        'css': 'css', 'scss': 'scss', 'less': 'less',
        'sql': 'sql',
        'sh': 'bash', 'bash': 'bash', 'zsh': 'bash',
        'yaml': 'yaml', 'yml': 'yaml',
        'json': 'json',
        'xml': 'xml',
        'md': 'markdown',
        'dockerfile': 'dockerfile'
    };

    return map[ext] || 'text';
};
