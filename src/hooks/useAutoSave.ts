import { useEffect, useState, useCallback } from 'react';

const DEBOUNCE_MS = 1000;

export function useAutoSave(filePath: string | null, content: string, originalContent: string) {
    const [hasDraft, setHasDraft] = useState(false);
    const [draftContent, setDraftContent] = useState<string | null>(null);

    // Check for draft — only show notification if draft differs from BOTH
    // original content AND current content (so tab switches don't trigger it)
    useEffect(() => {
        if (!filePath) {
            setHasDraft(false);
            setDraftContent(null);
            return;
        }

        const savedDraft = localStorage.getItem(`peek_draft_${filePath}`);
        if (savedDraft && savedDraft !== originalContent && savedDraft !== content) {
            // Draft exists and differs from both saved file AND what user sees
            setHasDraft(true);
            setDraftContent(savedDraft);
        } else {
            setHasDraft(false);
            setDraftContent(null);
            // Cleanup stale draft if it matches original
            if (savedDraft === originalContent) {
                localStorage.removeItem(`peek_draft_${filePath}`);
            }
        }
    }, [filePath, originalContent]);

    // Save draft logic
    useEffect(() => {
        if (!filePath) return;

        const handler = setTimeout(() => {
            if (content !== originalContent) {
                localStorage.setItem(`peek_draft_${filePath}`, content);
            } else {
                localStorage.removeItem(`peek_draft_${filePath}`);
            }
        }, DEBOUNCE_MS);

        return () => clearTimeout(handler);
    }, [filePath, content, originalContent]);

    const clearDraft = useCallback(() => {
        if (filePath) {
            localStorage.removeItem(`peek_draft_${filePath}`);
            setHasDraft(false);
            setDraftContent(null);
        }
    }, [filePath]);

    return { hasDraft, draftContent, clearDraft };
}

export function getAllDrafts(): string[] {
    const drafts: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('peek_draft_')) {
            drafts.push(key.replace('peek_draft_', ''));
        }
    }
    return drafts;
}
