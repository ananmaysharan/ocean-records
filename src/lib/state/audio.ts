import { writable } from 'svelte/store';
import type { SoundType } from '$lib/data';

const highlightStore = writable<SoundType | null>(null);

export const soundHighlight = {
	subscribe: highlightStore.subscribe
};

export function setSoundHighlight(value: SoundType | null) {
	highlightStore.set(value);
}

export function clearSoundHighlight() {
	highlightStore.set(null);
}
