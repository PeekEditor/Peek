import { useState, useCallback } from 'react';

export interface Cursor {
    id: string;
    start: number;
    end: number;
}

export function useMultiCursor() {
    const [cursors, setCursors] = useState<Cursor[]>([]);

    // Helper to generate unique ID
    const genId = () => Math.random().toString(36).substr(2, 9);

    const addCursor = useCallback((start: number, end: number) => {
        setCursors(prev => [...prev, { id: genId(), start, end }]);
    }, []);

    const clearCursors = useCallback(() => {
        setCursors([]);
    }, []);

    // Core logic: Apply an edit (insert/delete) to all cursors
    // Returns new content and new cursor positions
    const applyEdit = useCallback((content: string, editType: 'insert' | 'delete' | 'deleteForward', text: string = '') => {
        // Process cursors from LAST to FIRST to avoid index shifting problems during content modification
        // We need updates for all cursors though.

        // 1. Sort cursors by start position descending
        // We also need to know the *original* index to update the correct cursor object, 
        // but since we replace the whole array, mapping is fine if we track IDs.

        // Actually, we need to process modifications descending, but calculate new positions for ALL cursors.
        // A cursor at pos 10 needs to shift if an edit happened at pos 5.
        // A cursor at pos 5 needs to shift if it edited itself.

        // Let's copy cursors and sort them by start position (ascending) to make valid logic easier?
        // No, if we insert at 5, pos 10 becomes 11.
        // If we insert at 10, pos 5 stays 5.

        const sortedCursors = [...cursors].sort((a, b) => a.start - b.start);

        // We will build the new string and new cursors in one pass?
        // Or string first, then cursors?
        // String construction:
        // Slices: [0..c1.start] + INSERT + [c1.end..c2.start] + INSERT ...

        let constructedContent = '';
        let lastIndex = 0;
        const newCursors: Cursor[] = [];

        // Track cumulative offset for cursor position updates
        // For each cursor, the shift is (previous_edits_len_diff).
        // But the cursor ITSELF modifies length.

        // Let's do string construction and track offset.

        sortedCursors.forEach(cursor => {
            // Append text before this cursor
            constructedContent += content.substring(lastIndex, cursor.start);

            // Handle edit
            if (editType === 'insert') {
                constructedContent += text;
                // New cursor position: after inserted text. Selection collapses.
                const newPos = constructedContent.length;
                newCursors.push({ id: cursor.id, start: newPos, end: newPos });
                // If it was a selection, cursor.end was > cursor.start. Selection is replaced.

                lastIndex = cursor.end; // Skip replaced text
            } else if (editType === 'delete') {
                // Backspace behavior
                if (cursor.start !== cursor.end) {
                    // Selection delete
                    lastIndex = cursor.end;
                    const newPos = constructedContent.length;
                    newCursors.push({ id: cursor.id, start: newPos, end: newPos });
                } else {
                    // Caret delete (Backspace)
                    if (constructedContent.length > 0) {
                        constructedContent = constructedContent.slice(0, -1);
                    }
                    lastIndex = cursor.start;
                    const newPos = constructedContent.length;
                    newCursors.push({ id: cursor.id, start: newPos, end: newPos });
                }
            } else if (editType === 'deleteForward') {
                // Delete behavior (Fn+Backspace)
                if (cursor.start !== cursor.end) {
                    // Selection delete (same as backspace)
                    lastIndex = cursor.end;
                    const newPos = constructedContent.length;
                    newCursors.push({ id: cursor.id, start: newPos, end: newPos });
                } else {
                    // Caret delete forward
                    // We append text up to cursor.start.
                    // Then we need to SKIP the next char.
                    lastIndex = cursor.start + 1;
                    const newPos = constructedContent.length;
                    newCursors.push({ id: cursor.id, start: newPos, end: newPos });
                }
            }
        });

        // Append remaining text
        constructedContent += content.substring(lastIndex);

        return { newContent: constructedContent, newCursors };
    }, [cursors]);

    // Ctrl+D logic: Add next occurrence of current selection or word
    const addNextOccurrence = useCallback((content: string) => {
        setCursors(prev => {
            const main = prev[prev.length - 1];
            if (!main) return prev;

            const searchText = content.substring(main.start, main.end);

            // If empty selection, select word at cursor
            if (!searchText) {
                let start = main.start;
                let end = main.end;

                while (start > 0 && /\w/.test(content[start - 1])) start--;
                while (end < content.length && /\w/.test(content[end])) end++;

                if (start !== end) {
                    // Update main cursor to wrap word
                    // We must return a new array with the modified cursor
                    const newCursors = [...prev];
                    newCursors[newCursors.length - 1] = { ...main, start, end };
                    return newCursors;
                }
                return prev;
            }

            // Search for next occurrence
            let nextStart = content.indexOf(searchText, main.end);

            // Wrap around search
            if (nextStart === -1) {
                nextStart = content.indexOf(searchText, 0);
            }

            // Avoid duplicates and ensure we found something
            if (nextStart !== -1) {
                const nextEnd = nextStart + searchText.length;

                // Check if this range is already covered by ANY cursor
                const alreadySelected = prev.some(c => c.start === nextStart && c.end === nextEnd);

                if (!alreadySelected) {
                    const newCursor = { id: genId(), start: nextStart, end: nextEnd };
                    return [...prev, newCursor];
                }
            }

            return prev;
        });
    }, []);

    return { cursors, setCursors, addCursor, clearCursors, applyEdit, addNextOccurrence };
}
