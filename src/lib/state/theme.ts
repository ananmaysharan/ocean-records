import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type ThemeId = 'light' | 'dark' | 'blue';

const THEMES: ThemeId[] = ['light', 'dark', 'blue'];
const DEFAULT_THEME: ThemeId = 'blue';

const theme = writable<ThemeId>(DEFAULT_THEME);

function applyTheme(value: ThemeId): void {
    if (!browser) return;
    document.documentElement.setAttribute('data-theme', value);
}

export function setTheme(value: ThemeId): void {
    theme.set(value);
    applyTheme(value);
}

theme.subscribe(($theme) => {
    if (browser) {
        const current = document.documentElement.getAttribute('data-theme');
        if (current !== $theme) {
            document.documentElement.setAttribute('data-theme', $theme);
        }
    }
});

export function toggleTheme(): void {
    theme.update((current) => {
        const index = THEMES.indexOf(current);
        const next = THEMES[(index + 1) % THEMES.length];
        applyTheme(next);
        return next;
    });
}

export function initializeTheme(): void {
    theme.set(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
}

export { theme };