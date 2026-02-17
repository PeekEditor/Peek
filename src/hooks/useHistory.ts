import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

export function useHistory<T>(initialPresent: T) {
    const [state, setState] = useState<HistoryState<T>>({
        past: [],
        present: initialPresent,
        future: [],
    });

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const undo = useCallback(() => {
        setState((currentState) => {
            if (currentState.past.length === 0) return currentState;

            const previous = currentState.past[currentState.past.length - 1];
            const newPast = currentState.past.slice(0, currentState.past.length - 1);

            return {
                past: newPast,
                present: previous,
                future: [currentState.present, ...currentState.future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState((currentState) => {
            if (currentState.future.length === 0) return currentState;

            const next = currentState.future[0];
            const newFuture = currentState.future.slice(1);

            return {
                past: [...currentState.past, currentState.present],
                present: next,
                future: newFuture,
            };
        });
    }, []);

    const lastUpdateRef = useRef<number>(0);

    const set = useCallback((newPresent: T) => {
        const now = Date.now();
        // Batch edits if they happen within 1000ms
        const isBatch = (now - lastUpdateRef.current) < 1000;
        lastUpdateRef.current = now;

        setState((currentState) => {
            if (currentState.present === newPresent) return currentState;

            // If batching, update 'present' but keep 'past' as is.
            // Exception: If 'past' is empty, we must push to it so we can undo to initial state.
            if (isBatch && currentState.past.length > 0) {
                return {
                    past: currentState.past,
                    present: newPresent,
                    future: [],
                };
            }

            return {
                past: [...currentState.past, currentState.present],
                present: newPresent,
                future: [],
            };
        });
    }, []);

    const reset = useCallback((newPresent: T) => {
        setState({
            past: [],
            present: newPresent,
            future: [],
        });
    }, []);

    return { state: state.present, set, undo, redo, canUndo, canRedo, reset };
}
