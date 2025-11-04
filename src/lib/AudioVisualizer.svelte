<script>
    // @ts-nocheck
    import { onMount, onDestroy } from 'svelte';
    import { frequencyData, timeDomainData, isPlaying } from '$lib/utils/soundEffects';
    import { SOUND_TYPE_COLORS } from '$lib/data';
    import { soundHighlight } from '$lib/state/audio';
    
    let canvas;
    let ctx;
    let animationId;
    let currentFrequencyData = new Uint8Array(0);
    let currentTimeData = new Uint8Array(0);
    let playing = false;
    let highlight = null;
    
    // Subscribe to stores
    const unsubscribeFrequency = frequencyData.subscribe(value => {
        currentFrequencyData = value;
    });
    const unsubscribeTime = timeDomainData.subscribe(value => {
        currentTimeData = value;
    });
    
    const unsubscribePlaying = isPlaying.subscribe(value => {
        playing = value;
        if (canvas && !animationId) {
            startVisualization();
        }
    });

    const unsubscribeHighlight = soundHighlight.subscribe((value) => {
        highlight = value;
    });
    
    onMount(() => {
        if (canvas) {
            ctx = canvas.getContext('2d');
            resizeCanvas();
            startVisualization();
        }
    });
    
    onDestroy(() => {
        stopVisualization();
        unsubscribeFrequency();
        unsubscribeTime();
        unsubscribePlaying();
        unsubscribeHighlight();
    });
    
    function resizeCanvas() {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    function startVisualization() {
        if (animationId) return;
        draw();
    }
    
    function stopVisualization() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    function draw() {
        if (!ctx || !canvas) return;
        
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Resolve stroke color based on highlight or fallback to text color
        const fallbackColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border-subtle')
            .trim() || '#21558d';
        const accentColor = highlight ? SOUND_TYPE_COLORS[highlight] ?? fallbackColor : fallbackColor;
        
        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.75;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        
        if ((currentTimeData.length === 0 && currentFrequencyData.length === 0) || !playing) {
            // Draw straight line when no sound is playing
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();
            animationId = requestAnimationFrame(draw);
            return;
        }
        
        // Prefer time-domain waveform so the entire width animates regardless of spectral content
        const wave = currentTimeData.length ? currentTimeData : currentFrequencyData;
        const bufferLength = wave.length;
        const sliceWidth = width / bufferLength;
        let x = 0;
        
        // Compute auto-gain from RMS so quiet clips still have visible height
        let sumSq = 0;
        for (let i = 0; i < bufferLength; i++) {
            const centered = (wave[i] - 128) / 128; // -1..1
            sumSq += centered * centered;
        }
        const rms = Math.sqrt(sumSq / bufferLength) || 0.0001;
        const targetAmp = height * 0.35;
        const gain = Math.min(6, targetAmp / (rms * height * 0.5)); // clamp gain

        // Optional tilt to give some jaggedness across width even if spectrum is narrow
        // Use a small high-frequency emphasis
        for (let i = 0; i < bufferLength; i++) {
            const t = i / (bufferLength - 1);
            const v = (wave[i] - 128) / 128; // -1..1
            const tilt = 0.15 * (Math.random() - 0.5) + 0.1 * (t - 0.5); // subtle
            const y = height / 2 + (v * gain + tilt) * (height * 0.5);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.stroke();
        
        animationId = requestAnimationFrame(draw);
    }
</script>

<svelte:window on:resize={resizeCanvas} />

<div class="visualizer-container">
    <canvas bind:this={canvas}></canvas>
</div>

<style>
    .visualizer-container {
        width: 100%;
        height: 40px;
        position: relative;
    }
    
    canvas {
        width: 100%;
        height: 100%;
        display: block;
    }
</style>
