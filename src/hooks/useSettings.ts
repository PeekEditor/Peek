import { useState, useEffect, useCallback } from 'react';

export interface Settings {
    // Editor
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    showMiniMap: boolean;
    showLineNumbers: boolean;

    // Behavior
    autoSaveDrafts: boolean;
    confirmUnsavedChanges: boolean;

    // Appearance
    theme: string;
}

const DEFAULT_SETTINGS: Settings = {
    fontSize: 14,
    tabSize: 4,
    wordWrap: false,
    showMiniMap: true,
    showLineNumbers: true,
    autoSaveDrafts: true,
    confirmUnsavedChanges: true,
    theme: 'midnight',
};

const STORAGE_KEY = 'peek_settings';

function loadSettings(): Settings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

export function useSettings() {
    const [settings, setSettings] = useState<Settings>(loadSettings);

    // Persist on change
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);

    const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetSettings = useCallback(() => {
        setSettings({ ...DEFAULT_SETTINGS });
    }, []);

    return { settings, updateSetting, resetSettings };
}

export { DEFAULT_SETTINGS };
