// @ts-nocheck
import { writable } from 'svelte/store';

const soundMap: Record<string, string> = {
    ships: '/assets/sounds/ship.wav',
    bluewhale: '/assets/sounds/bluewhale.wav',
    finwhale: '/assets/sounds/finwhale.wav',
    humpbackwhale: '/assets/sounds/humpback.wav',
    dolphins: '/assets/sounds/dolphin.wav',
    bocaccio: '/assets/sounds/bocaccio.wav',
    explosions: '/assets/sounds/explosion.wav',
};

const activeAudios: Map<string, HTMLAudioElement> = new Map();
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;
let timeArray: Uint8Array | null = null;
let animationFrameId: number | null = null;

// Store to track if any sound is playing
export const isPlaying = writable(false);

// Store for frequency data
export const frequencyData = writable<Uint8Array>(new Uint8Array(0));
// Store for time-domain waveform data
export const timeDomainData = writable<Uint8Array>(new Uint8Array(0));

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        // time domain array uses fftSize length
        timeArray = new Uint8Array(analyser.fftSize);
        
        analyser.connect(audioContext.destination);
    }
    return audioContext;
}

function startAnalysis() {
    if (!analyser || !dataArray || !timeArray) return;
    
    const updateFrequencyData = () => {
        if (!analyser || !dataArray || !timeArray) return;
        
        analyser.getByteFrequencyData(dataArray);
        frequencyData.set(dataArray);
        analyser.getByteTimeDomainData(timeArray);
        timeDomainData.set(timeArray);
        
        if (activeAudios.size > 0) {
            animationFrameId = requestAnimationFrame(updateFrequencyData);
        } else {
            stopAnalysis();
        }
    };
    
    if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(updateFrequencyData);
    }
}

function stopAnalysis() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    frequencyData.set(new Uint8Array(0));
}

export function playSound(type: string): void {
    const soundPath = soundMap[type];
    if (!soundPath) {
        console.warn(`No sound mapped for type: ${type}`);
        return;
    }

    // Stop existing sound of this type if playing
    stopSound(type);

    try {
        const audio = new Audio(soundPath);
        audio.loop = true;
        audio.volume = 0.5;

        const context = getAudioContext();
        
        // Resume audio context if suspended (required by some browsers)
        if (context.state === 'suspended') {
            context.resume();
        }

        // Create media element source and connect to analyser
        const source = context.createMediaElementSource(audio);
        source.connect(analyser!);

        audio.play().catch((error) => {
            console.error('Error playing sound:', error);
        });

        activeAudios.set(type, audio);
        isPlaying.set(true);
        startAnalysis();

        audio.addEventListener('ended', () => {
            stopSound(type);
        });
    } catch (error) {
        console.error('Error initializing sound:', error);
    }
}

export function stopSound(type: string): void {
    const audio = activeAudios.get(type);
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        activeAudios.delete(type);
        
        if (activeAudios.size === 0) {
            isPlaying.set(false);
            stopAnalysis();
        }
    }
}

export function stopAllSounds(): void {
    activeAudios.forEach((audio, type) => {
        audio.pause();
        audio.currentTime = 0;
    });
    activeAudios.clear();
    isPlaying.set(false);
    stopAnalysis();
}
