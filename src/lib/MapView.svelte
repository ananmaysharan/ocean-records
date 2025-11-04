<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import gsap from 'gsap';
	import mapboxgl from 'mapbox-gl';
	import "iconify-icon";
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { fade } from 'svelte/transition';
	import sensorsGeo from '$lib/assets/sensors.geo.json';
	import { SENSOR_METADATA } from '$lib/data';
	import { selectedSensor, canGoBack, selectedDay, type SelectedDay } from '$lib/state/navigation';
	import { theme, type ThemeId } from '$lib/state/theme';
	import type { CircleLayerSpecification, MapMouseEvent, GeoJSONFeature } from 'mapbox-gl';
	import type { FeatureCollection, Point } from 'geojson';
	import BackButton from './BackButton.svelte';
	import AudioVisualizer from './AudioVisualizer.svelte';
	import DayCardPreview from './components/DayCardPreview.svelte';
	import PerchAnalysisChart from './components/PerchAnalysisChart.svelte';
	import type { DayCardPreviewData } from '$lib/types/day-card';

	// Types
	type MapMode = 'intro' | 'sidebar';

	type SensorLayerMouseEvent = MapMouseEvent & {
		features?: GeoJSONFeature[];
	};

	// Export props
	export let mode: MapMode = 'intro';
	export let onIntroComplete: (() => void) | undefined = undefined;

	const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

	if (browser) {
		mapboxgl.accessToken = MAPBOX_TOKEN ?? '';
		if (!MAPBOX_TOKEN) {
			console.warn('VITE_MAPBOX_TOKEN is not set. Mapbox may fail to load.');
		}
	}

	const MAP_STYLES: Record<ThemeId, string> = {
		dark: 'mapbox://styles/mapbox/dark-v11',
		light: 'mapbox://styles/mapbox/light-v11',
		blue: 'mapbox://styles/ananmay/cmgy3hw6600av01qobkev8nq0'
	};

	const INTRO_SPIN_SECONDS_PER_REVOLUTION = 90;
	const INTRO_SPIN_MAX_ZOOM = 5;
	const INTRO_SPIN_SLOW_ZOOM = 3;

	const INTRO_CAMERA = {
		center: [-101, 70] as [number, number],
		zoom: 0.55,
		pitch: 0,
		bearing: 0
	};

	const ZOOM_CAMERA = {
		center: [-121.91349, 36.61084] as [number, number],
		zoom: 8.5,
		pitch: 45,
		bearing: -20
	};

    const SIDEBAR_CAMERA = {
		center: [-121.02501, 36.86538] as [number,number], //[-121.91349, 36.61084] as [number, number],
		zoom: 8.5,
		pitch: 0,
		bearing: 0
	};

	const ENTER_TRANSITION_DURATION = 300;

	const ACTIVE_FILL_FALLBACK = '#222';
	const INACTIVE_FILL = '#eee';
	const INACTIVE_STROKE = '#ffffff';
	const ACTIVE_STROKE_FALLBACK = '#ffffff';

	const dayOverlayFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
});

	const sensorsData: FeatureCollection<Point, { sensorId: string; label?: string; popup?: string | null }> = {
		type: 'FeatureCollection',
		features: sensorsGeo.features.map((feature: any, index: number) => ({
			type: 'Feature',
			geometry: feature.geometry,
			properties: {
				...feature.properties,
				sensorId: SENSOR_METADATA[index]?.id ?? `sensor-${index + 1}`,
				label: feature.properties?.label,
				popup: feature.properties?.popup ?? null
			}
		}))
	};

	// Variables
	// Map-related
	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let mapReady = false;
	let currentMode: MapMode = mode;
	let currentTheme: ThemeId = 'dark';
	let currentStyleUrl: string | null = MAP_STYLES[currentTheme] ?? MAP_STYLES.dark;

	// Sensor-related
	let activeSensorId = 'sensor-01';
	let activeSensorMeta = SENSOR_METADATA.find((item) => item.id === activeSensorId);
	let activeSensorDescription = '';

	// UI-related
	let showEnterButton = false;
	let isTransitioning = false;
	let dayOverlayCard: DayCardPreviewData | null = null;
	let dayOverlayLabel: string | null = null;
	let introSpinEnabled = false;
	let introUserInteracting = false;

	// Subscriptions
	let unsubscribeTheme: (() => void) | undefined;
	let unsubscribeSensor: (() => void) | undefined;

	// GSAP
	let Flip: any;

    onMount(async () => {
        const FlipModule = await import('gsap/Flip');
        Flip = FlipModule.default;
        gsap.registerPlugin(Flip);
    });

	onMount(() => {
		if (!browser) return;

		currentTheme = get(theme);
		activeSensorId = get(selectedSensor);
		activeSensorMeta = SENSOR_METADATA.find((item) => item.id === activeSensorId);

		unsubscribeTheme = theme.subscribe((value) => {
			currentTheme = value;
			if (mapReady) {
				updateMapStyle(value);
			}
		});

		unsubscribeSensor = selectedSensor.subscribe((value) => {
			if (value) {
				activeSensorId = value;
				activeSensorMeta = SENSOR_METADATA.find((item) => item.id === activeSensorId);
				if (mapReady) {
					updateSensorLayer();
				}
			}
		});

		map = new mapboxgl.Map({
			container: mapContainer,
			style: MAP_STYLES[currentTheme] ?? MAP_STYLES.dark,
			center: mode === 'intro' ? INTRO_CAMERA.center : SIDEBAR_CAMERA.center,
			zoom: mode === 'intro' ? INTRO_CAMERA.zoom : SIDEBAR_CAMERA.zoom,
			pitch: mode === 'intro' ? INTRO_CAMERA.pitch : SIDEBAR_CAMERA.pitch,
			bearing: mode === 'intro' ? INTRO_CAMERA.bearing : SIDEBAR_CAMERA.bearing,
			failIfMajorPerformanceCaveat: false,
			attributionControl: false,
		});

		map.addControl(new mapboxgl.AttributionControl({
			compact: true
		}));

		currentStyleUrl = MAP_STYLES[currentTheme] ?? MAP_STYLES.dark;

		map.once('load', () => {
			mapReady = true;
			handleStyleLoad();
			if (mode === 'intro') {
				showEnterButton = true;
				startIntroSpin();
			}
		});
		map.on('style.load', handleStyleLoad);
		map.on('mousedown', handleIntroInteractionStart);
		map.on('touchstart', handleIntroInteractionStart);
		map.on('mouseup', handleIntroInteractionEnd);
		map.on('touchend', handleIntroInteractionEnd);
		map.on('dragend', handleIntroInteractionEnd);
		map.on('pitchend', handleIntroInteractionEnd);
		map.on('rotateend', handleIntroInteractionEnd);
		map.on('moveend', handleIntroMoveEnd);
		return () => {
			cleanup();
		};
	});

	onDestroy(() => {
		cleanup();
	});

	$: if (mapReady) {
		applyMode(mode);
	}

	// Update sensor description when active sensor changes
	$: {
		const sensorFeature = sensorsData.features.find(
			(feature) => feature.properties.sensorId === activeSensorId
		);
		if (sensorFeature?.properties.popup) {
			// Extract text from HTML popup
			const tempDiv = browser ? document.createElement('div') : null;
			if (tempDiv) {
				tempDiv.innerHTML = sensorFeature.properties.popup;
				// Get the text content and remove the sensor label prefix
				const fullText = tempDiv.textContent || '';
				// Remove the label part (e.g., "MB01: ") and keep only the description
				activeSensorDescription = fullText.replace(/^[^:]+:\s*/, '').trim();
			} else {
				activeSensorDescription = '';
			}
		} else {
			activeSensorDescription = '';
		}
	}

	// Functions
	// Mode/animation
	function handleEnterClick() {
		if (!map || !mapReady || isTransitioning) return;
		
		isTransitioning = true;
		showEnterButton = false;
		stopIntroSpin();

		// First zoom to the site
		map.flyTo({
			center: ZOOM_CAMERA.center,
			zoom: ZOOM_CAMERA.zoom,
			pitch: ZOOM_CAMERA.pitch,
			bearing: ZOOM_CAMERA.bearing,
			duration: 3_000,
			essential: true
		});

		// After zoom completes, transition to sidebar mode and shrink
		map.once('moveend', () => {
			if (!map) return;
			
			// Small delay before shrinking to make it feel more natural
			setTimeout(() => {
				if (!map) return;
				
				// Transition to sidebar camera
				map.easeTo({
					center: SIDEBAR_CAMERA.center,
					zoom: SIDEBAR_CAMERA.zoom,
					pitch: SIDEBAR_CAMERA.pitch,
					bearing: SIDEBAR_CAMERA.bearing,
					duration: 1_000,
					essential: true
				});

				// Animate container shrink
				animateContainer('sidebar', true);
				
				// Notify parent after animation starts
				setTimeout(() => {
					isTransitioning = false;
					onIntroComplete?.();
				}, 500);
			}, 300);
		});
	}

	function applyMode(nextMode: MapMode, options: { animate?: boolean; force?: boolean } = {}) {
		if (!map || !mapReady) return;
		if (currentMode === nextMode && !options.force) return;

		const animate = options.animate ?? true;
		currentMode = nextMode;

		if (nextMode === 'intro') {
			showEnterButton = true;
			if (!isTransitioning) {
				map.stop();
				if (animate) {
					map.easeTo({ ...INTRO_CAMERA, duration: 1_200, essential: true });
				} else {
					map.jumpTo(INTRO_CAMERA);
				}
			}
			startIntroSpin();
		} else {
			showEnterButton = false;
			if (!isTransitioning) {
				map.stop();
				if (animate) {
					map.easeTo({ ...SIDEBAR_CAMERA, duration: 1_000, essential: true });
				} else {
					map.jumpTo(SIDEBAR_CAMERA);
				}
				animateContainer(nextMode, animate);
			}
			stopIntroSpin();
		}
	}

	function animateContainer(nextMode: MapMode, animate: boolean) {
		if (!mapContainer) return;
		const mapRoot = mapContainer.parentElement;
        if (!mapRoot) return;

        const targetRadius = nextMode === 'sidebar' ? '1rem' : '0rem';

        if (!animate) {
            mapContainer.style.borderRadius = targetRadius;
            return;
        }

        // Capture state before layout change
        if (Flip) {
            const state = Flip.getState(mapRoot);
            
            // Let the parent's reactive classes update the layout
            requestAnimationFrame(() => {
                // Animate from old state to new layout
                Flip.from(state, {
                    duration: 1.0,
                    ease: 'power2.inOut',
                    absolute: true,
                    onComplete: () => {
                        // Clean up inline styles
                        gsap.set(mapRoot, { clearProps: 'all' });
                    }
                });
            });
        }
	}

	// Map setup
	function handleStyleLoad() {
		if (!map) return;
		addSensorsLayer();
		updateSensorLayer();
		if (currentMode === 'sidebar') {
			startIntroSpin();
		} else {
			startIntroSpin();
		}
	}

	function addSensorsLayer() {
		if (!map) return;
		const sourceId = 'sensors';
		const layerId = 'sensors-layer';

		if (!map.getSource(sourceId)) {
			map.addSource(sourceId, {
				type: 'geojson',
				data: sensorsData
			});
		} else {
			const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
			source.setData(sensorsData);
		}

		if (!map.getLayer(layerId)) {
			const layer: CircleLayerSpecification = {
				id: layerId,
				type: 'circle',
				source: sourceId,
				paint: buildSensorPaint(activeSensorId),
				minzoom: 3,
			};
			map.addLayer(layer);
		}

		map.off('click', layerId, handleSensorClick);
		map.off('mouseenter', layerId, handleSensorEnter);
		map.off('mouseleave', layerId, handleSensorLeave);

		map.on('click', layerId, handleSensorClick);
		map.on('mouseenter', layerId, handleSensorEnter);
		map.on('mouseleave', layerId, handleSensorLeave);
	}

	function updateSensorLayer() {
		if (!map) return;
		const layerId = 'sensors-layer';
		if (!map.getLayer(layerId)) return;

		const paint = buildSensorPaint(activeSensorId);
		for (const [key, value] of Object.entries(paint ?? {})) {
			map.setPaintProperty(layerId, key as any, value as any);
		}
	}

	// Utilities
	function resolveSelectedDate(selection: SelectedDay | null): Date | null {
		if (!selection) return null;
		const { time } = selection as { time?: string | Date };
		if (time instanceof Date) {
			return time;
		}
		if (typeof time === 'string') {
			const parsed = new Date(time);
			if (!Number.isNaN(parsed.getTime())) {
				return parsed;
			}
		}
		const isoDay = typeof selection?.isoDay === 'string' ? selection.isoDay : undefined;
		if (isoDay) {
			const parsed = new Date(isoDay);
			if (!Number.isNaN(parsed.getTime())) {
				return parsed;
			}
		}
		return null;
	}

	$: {
		const selection = $selectedDay as (SelectedDay & { dayCard?: DayCardPreviewData | null }) | null;
		dayOverlayCard = selection?.dayCard ?? null;
		const selectionDate = resolveSelectedDate(selection ?? null);
		dayOverlayLabel = selectionDate ? dayOverlayFormatter.format(selectionDate) : null;
	}

	function getAccentColors() {
		if (!browser) {
			return {
				fill: ACTIVE_FILL_FALLBACK,
				stroke: ACTIVE_STROKE_FALLBACK
			};
		}
		const styles = getComputedStyle(document.documentElement);
		const fill = styles.getPropertyValue('--accent').trim() || ACTIVE_FILL_FALLBACK;
		const stroke = styles.getPropertyValue('--text-strong').trim() || ACTIVE_STROKE_FALLBACK;
		return { fill, stroke };
	}

	function buildSensorPaint(sensorId: string): CircleLayerSpecification['paint'] {
		const { fill, stroke } = getAccentColors();
		return {
			'circle-radius': ['case', ['==', ['get', 'sensorId'], sensorId], 10, 6],
			'circle-color': ['case', ['==', ['get', 'sensorId'], sensorId], fill, INACTIVE_FILL],
			'circle-stroke-width': 2,
			'circle-stroke-color': ['case', ['==', ['get', 'sensorId'], sensorId], stroke, INACTIVE_STROKE],
			'circle-opacity': 0.95
		} as unknown as CircleLayerSpecification['paint'];
	}

	// Cleanup
	function cleanup() {
		unsubscribeTheme?.();
		unsubscribeSensor?.();
		unsubscribeTheme = undefined;
		unsubscribeSensor = undefined;
		if (map) {
			map.off('style.load', handleStyleLoad);
			const layerId = 'sensors-layer';
			map.off('click', layerId, handleSensorClick);
			map.off('mouseenter', layerId, handleSensorEnter);
			map.off('mouseleave', layerId, handleSensorLeave);
			map.off('mousedown', handleIntroInteractionStart);
			map.off('touchstart', handleIntroInteractionStart);
			map.off('mouseup', handleIntroInteractionEnd);
			map.off('touchend', handleIntroInteractionEnd);
			map.off('dragend', handleIntroInteractionEnd);
			map.off('pitchend', handleIntroInteractionEnd);
			map.off('rotateend', handleIntroInteractionEnd);
			map.off('moveend', handleIntroMoveEnd);
			map.remove();
		}
		map = null;
		mapReady = false;
		isTransitioning = false;
		introSpinEnabled = false;
		introUserInteracting = false;
	}

	// Sensor
	function handleSensorClick(event: SensorLayerMouseEvent) {
		const feature = event.features?.[0];
		const sensorId = feature?.properties?.sensorId as string | undefined;
		if (sensorId) {
			selectedSensor.set(sensorId);
		}
	}

	function handleSensorEnter() {
		map?.getCanvas().classList.add('cursor-pointer');
	}

	function handleSensorLeave() {
		map?.getCanvas().classList.remove('cursor-pointer');
	}

		function updateMapStyle(nextTheme: ThemeId) {
			if (!map) return;
			const targetStyle = MAP_STYLES[nextTheme] ?? MAP_STYLES.dark;
			if (currentStyleUrl === targetStyle) return;
			map.setStyle(targetStyle);
			currentStyleUrl = targetStyle;
		}

		// Intro spin
		function spinIntroGlobe() {
			if (!map || !introSpinEnabled || introUserInteracting || currentMode !== 'intro') return;
			const zoom = map.getZoom();
			if (zoom >= INTRO_SPIN_MAX_ZOOM) return;
			let distancePerSecond = 360 / INTRO_SPIN_SECONDS_PER_REVOLUTION;
			if (zoom > INTRO_SPIN_SLOW_ZOOM) {
				const zoomDiff = (INTRO_SPIN_MAX_ZOOM - zoom) / (INTRO_SPIN_MAX_ZOOM - INTRO_SPIN_SLOW_ZOOM);
				distancePerSecond *= Math.max(zoomDiff, 0);
			}
			const center = map.getCenter();
			center.lng -= distancePerSecond;
			map.easeTo({ center, duration: 1_000, easing: (n) => n });
		}

		function startIntroSpin() {
			if (!browser || !map || currentMode !== 'intro') return;
			introSpinEnabled = true;
			introUserInteracting = false;
			// Avoid re-triggering during transitions
			if (!map?.isMoving()) {
				spinIntroGlobe();
			}
		}

		function stopIntroSpin() {
			introSpinEnabled = false;
			introUserInteracting = false;
			map?.stop();
		}

		function handleIntroInteractionStart() {
			if (currentMode !== 'intro') return;
			introUserInteracting = true;
			map?.stop();
		}

		function handleIntroInteractionEnd() {
			if (currentMode !== 'intro') return;
			introUserInteracting = false;
			spinIntroGlobe();
		}

		function handleIntroMoveEnd() {
			if (currentMode !== 'intro') return;
			spinIntroGlobe();
		}
</script>

<svelte:window on:resize={() => map?.resize()} />

<div class="map-root" data-mode={mode}>
	<div class="map-container" bind:this={mapContainer}></div>

	{#if mode === 'sidebar'}
		<div class="map-gradient-overlay" in:fade={{ duration: 300, delay: 1000 }}></div>
	{/if}

	{#if mode === 'intro' && showEnterButton}
		<div class="enter-overlay" transition:fade={{ duration: ENTER_TRANSITION_DURATION }}>
		<div class="flex flex-col items-center gap-6">
        <h1 class="text-8xl font-semibold font-serif text-text-primary">Ocean Records</h1>
				<h5 class="text-text-primary font-mono uppercase text-2xl">Biophony & Anthrophony in Monterey Bay</h5>
		</div>
			<button class="enter-button flex align-center" type="button" on:click={handleEnterClick}>
				Enter
			</button>
		</div>

	{/if}

	{#if mode === 'sidebar' && $selectedDay}
		<div class="day-overlay">
			<div class="day-overlay__content">
				{#if dayOverlayLabel}
					<header class="day-header">
						<h1 class="font-mono">{dayOverlayLabel}</h1>
					</header>
				{/if}
				{#if dayOverlayCard}
					<DayCardPreview card={dayOverlayCard} />
				{/if}
				<PerchAnalysisChart />
			</div>
		</div>
	{/if}

	{#if mode === 'sidebar' && activeSensorMeta}
		<div class="sensor-info text-text-primary" in:fade={{ duration: 300, delay: 1000 }}>
			<div class="flex items-center gap-3">
				{#if $canGoBack}
					<BackButton />
				{/if}
				<div class="flex space-x-2">
					<h1 class="text-2xl font-serif text-text-primary">Ocean Records</h1>
				</div>
			</div>
			<p class="sensor-title font-mono mt-4">Sensor {activeSensorMeta.label}</p>
			<!-- <p class="sensor-subtitle">{activeSensorMeta.id.toUpperCase()}</p> -->
			{#if activeSensorDescription}
				<p class="sensor-description">{activeSensorDescription}</p>
			{/if}
			<AudioVisualizer />

		</div>
	{/if}
</div>

<style>
	.map-root {
		position: relative;
		width: 100%;
		min-height: 100vh;
		height: 100%;
	}

	.map-container {
		position: absolute;
		inset: 0;
		overflow: hidden;
		border-radius: inherit;
	}

	.map-gradient-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 35rem;
		background: linear-gradient(to bottom, var(--surface-1) 0%, rgba(0, 0, 0, 0) 100%);
		pointer-events: none;
		z-index: 5;
		opacity: 1;
	}

	.enter-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		gap: 30rem;
	}

	.enter-button {
		pointer-events: auto;
		padding: 0.75rem 2.5rem;
		border: none;
		font-size: 1rem;
		text-transform: uppercase;
		/* background: var(--surface-overlay); */
		border: 1px solid var(--border-subtle);
		backdrop-filter: blur(12px); /* Blur effect */
        -webkit-backdrop-filter: blur(12px); /* Safari support */
		cursor: pointer;
		transition: transform 200ms ease, box-shadow 200ms ease;
		align-items: center;
		gap: 0.5rem;
		display: flex;
	}

	.enter-button:hover {
		transform: translateY(-2px);
	}

	.enter-button:focus-visible {
		outline: 2px solid var(--text-strong);
		outline-offset: 4px;
	}

	.map-root[data-mode='intro'] .map-container {
		border-radius: 0;
		box-shadow: none;
	}

	.sensor-info {
		position: absolute;
		top: 1rem;
		left: 1rem;
		border-radius: 0.75rem;
		z-index: 30;
	}

	.sensor-title {
		font-weight: 600;
	}

	.sensor-description {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		line-height: 1.4;
		color: var(--text-secondary);
		max-width: 20rem;
	}

	.day-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		padding: 1rem;
		pointer-events: none;
		z-index: 20;
	}

	.day-overlay::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--surface-1);
		opacity: 1;
	}

	.day-overlay__content {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		pointer-events: auto;
		max-width: min(480px, 90vw);
		margin-top: 13rem;
		border: 1px solid var(--border-subtle);
		padding: 1.5rem;
		border-radius: 0.5rem;
	}

	.day-header {
		margin: 0;
	}

	.day-header h1 {
		margin: 0;
		color: var(--text-primary);
	}

	:global(.cursor-pointer) {
		cursor: pointer !important;
	}
</style>