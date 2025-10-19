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
	import { MapboxOverlay } from '@deck.gl/mapbox';
	import { TripsLayer } from '@deck.gl/geo-layers';
	import {
		loadShippingTrips,
		preloadShippingTrips,
		SHIP_COLOR_RGBA,
		type ShippingTrip,
		type ShippingTripsDataset
	} from '$lib/data/shippingTrips';
	import DayCardPreview from './components/DayCardPreview.svelte';
	import PerchAnalysisChart from './components/PerchAnalysisChart.svelte';
	import type { DayCardPreviewData } from '$lib/types/day-card';

    let Flip: any;

	//test comment

	type MapMode = 'intro' | 'sidebar';

	type SensorLayerMouseEvent = MapMouseEvent & {
		features?: GeoJSONFeature[];
	};

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
		blue: 'mapbox://styles/ananmay/cmg5utiiy000x01qw2d2f1r7s'
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

	const SHIP_TRAIL_LENGTH = 10800;
	const SHIP_LOOP_DURATION_MS = 1_200_000; // 20 minutes for a full loop
	const SHIP_LOOP_START_DATE = new Date('2018-11-01T00:00:00Z');
	const SHIP_LOOP_END_DATE = new Date('2021-11-31T23:00:00Z');
	const SHIP_PROGRESS_STEP = 5;
	const HOUR_IN_MS = 60 * 60 * 1000;
	const SHIP_LOOP_RANGE_MS = Math.max(0, SHIP_LOOP_END_DATE.getTime() - SHIP_LOOP_START_DATE.getTime());

	const ACTIVE_FILL_FALLBACK = '#222';
	const INACTIVE_FILL = '#eee';
	const INACTIVE_STROKE = '#ffffff';
	const ACTIVE_STROKE_FALLBACK = '#ffffff';

	const shippingDateFormatter = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'UTC'
	});

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

	let deckOverlay: MapboxOverlay | null = null;
	let shippingDataset: ShippingTripsDataset | null = null;
	let baseTripsLayer: TripsLayer<ShippingTrip> | null = null;
	let shippingActivationPromise: Promise<void> | null = null;
	let animationHandle: number | null = null;
	let animationRunning = false;
	let shippingCurrentTime = 0;
	let maxShippingTimestamp = 0;
	let unitsPerMillisecond = 0;
	let lastAnimationTimestamp = 0;
	let lastProgressBucket = -1;
	let shippingActive = false;
	let shippingDisplayText = '';
	let shippingPaused = false;

	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let mapReady = false;
	let currentMode: MapMode = mode;
	let currentTheme: ThemeId = 'dark';
	let activeSensorId = 'sensor-01';
	let activeSensorMeta = SENSOR_METADATA.find((item) => item.id === activeSensorId);
	let activeSensorDescription = '';
	let currentStyleUrl: string | null = MAP_STYLES[currentTheme] ?? MAP_STYLES.dark;

	let unsubscribeTheme: (() => void) | undefined;
	let unsubscribeSensor: (() => void) | undefined;
	let showEnterButton = false;
	let isTransitioning = false;
	let dayOverlayCard: DayCardPreviewData | null = null;
	let dayOverlayLabel: string | null = null;
	let introSpinEnabled = false;
	let introUserInteracting = false;

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
			preloadShippingTrips();
			if (currentMode === 'sidebar') {
				void activateShippingLayer({ force: true });
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

		if (nextMode === 'sidebar') {
			void activateShippingLayer();
		} else {
			deactivateShippingLayer();
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

	function handleStyleLoad() {
		if (!map) return;
		addSensorsLayer();
		updateSensorLayer();
		if (currentMode === 'sidebar') {
			void activateShippingLayer({ force: true });
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

	function ensureDeckOverlay(): MapboxOverlay | null {
		if (!map) return null;
		if (deckOverlay) return deckOverlay;
		deckOverlay = new MapboxOverlay({ interleaved: true, layers: [] });
		map.addControl(deckOverlay);
		return deckOverlay;
	}

	function createBaseTripsLayer(dataset: ShippingTripsDataset): TripsLayer<ShippingTrip> {
		return new TripsLayer<ShippingTrip>({
			id: 'shipping-trips',
			data: dataset.trips,
			getPath: (trip: ShippingTrip) => trip.path,
			getTimestamps: (trip: ShippingTrip) => trip.timestamps,
			getColor: SHIP_COLOR_RGBA,
			opacity: 0.85,
			widthMinPixels: 4,
			rounded: true,
			trailLength: SHIP_TRAIL_LENGTH,
			currentTime: shippingCurrentTime,
			pickable: false,
			beforeId: 'sensors-layer'
		} as any);
	}

	function updateShippingLayer() {
		if (!deckOverlay || !baseTripsLayer) return;
		const layer = baseTripsLayer.clone({ currentTime: shippingCurrentTime });
		deckOverlay.setProps({ layers: [layer] });
	}

	function updateShippingDisplay() {
		if (!shippingActive || maxShippingTimestamp <= 0 || SHIP_LOOP_RANGE_MS <= 0) {
			shippingDisplayText = '';
			return;
		}
		const progress = Math.min(1, Math.max(0, shippingCurrentTime / maxShippingTimestamp));
		const totalHours = Math.floor((progress * SHIP_LOOP_RANGE_MS) / HOUR_IN_MS);
		const displayTimeMs = SHIP_LOOP_START_DATE.getTime() + totalHours * HOUR_IN_MS;
		const displayDate = new Date(Math.min(displayTimeMs, SHIP_LOOP_END_DATE.getTime()));
		shippingDisplayText = `${shippingDateFormatter.format(displayDate)}`;
	}

	function toggleShippingAnimation() {
		if (!shippingActive) return;
		if (shippingPaused) {
			shippingPaused = false;
			lastAnimationTimestamp = 0;
			startShippingAnimation(false);
		} else {
			shippingPaused = true;
			stopShippingAnimation();
			updateShippingDisplay();
		}
	}

	function logShippingProgress(progressPercent: number) {
		if (!Number.isFinite(progressPercent) || maxShippingTimestamp <= 0) return;
		const clamped = Math.min(100, Math.max(0, progressPercent));
		const bucket = Math.floor(clamped / SHIP_PROGRESS_STEP);
		if (bucket !== lastProgressBucket) {
			console.info(`[ShippingLayer] ${clamped.toFixed(1)}% complete`);
			lastProgressBucket = bucket;
		}
	}

	function stopShippingAnimation() {
		if (animationHandle !== null) {
			cancelAnimationFrame(animationHandle);
			animationHandle = null;
		}
		animationRunning = false;
		lastAnimationTimestamp = 0;
	}

	function deactivateShippingLayer() {
		stopShippingAnimation();
		shippingActive = false;
		lastProgressBucket = -1;
		shippingDisplayText = '';
		shippingPaused = false;
		if (deckOverlay) {
			deckOverlay.setProps({ layers: [] });
		}
	}

	function stepShippingAnimation(timestamp: number) {
		if (!animationRunning) return;
		if (!deckOverlay || !baseTripsLayer || !shippingDataset || maxShippingTimestamp <= 0) {
			stopShippingAnimation();
			return;
		}
		if (lastAnimationTimestamp === 0) {
			lastAnimationTimestamp = timestamp;
			updateShippingLayer();
			animationHandle = requestAnimationFrame(stepShippingAnimation);
			return;
		}
		const deltaMs = timestamp - lastAnimationTimestamp;
		lastAnimationTimestamp = timestamp;
		if (unitsPerMillisecond > 0) {
			shippingCurrentTime += deltaMs * unitsPerMillisecond;
		} else {
			shippingCurrentTime += deltaMs;
		}
		if (shippingCurrentTime >= maxShippingTimestamp && maxShippingTimestamp > 0) {
			shippingCurrentTime = shippingCurrentTime % maxShippingTimestamp;
			lastProgressBucket = -1;
			logShippingProgress(100);
		} else {
			logShippingProgress((shippingCurrentTime / maxShippingTimestamp) * 100);
		}
		updateShippingDisplay();
		updateShippingLayer();
		animationHandle = requestAnimationFrame(stepShippingAnimation);
	}

	function startShippingAnimation(resetProgress = false) {
		if (!browser) return;
		if (!deckOverlay || !baseTripsLayer || !shippingDataset || maxShippingTimestamp <= 0) return;
		if (animationRunning) return;
		if (shippingPaused) return;
		if (resetProgress) {
			lastProgressBucket = -1;
			if (maxShippingTimestamp > 0) {
				shippingCurrentTime = shippingCurrentTime % maxShippingTimestamp;
			}
		}
		animationRunning = true;
		lastAnimationTimestamp = 0;
		updateShippingDisplay();
		animationHandle = requestAnimationFrame(stepShippingAnimation);
	}

	async function activateShippingLayer(options: { force?: boolean } = {}) {
		if (!browser || !map || !mapReady) return;
		const force = options.force ?? false;
		if (shippingActivationPromise) {
			if (!force) return;
			await shippingActivationPromise;
		}
		const overlay = ensureDeckOverlay();
		if (!overlay) return;
		const wasActive = shippingActive;
		shippingActivationPromise = loadShippingTrips()
			.then((dataset) => {
				if (!map) return;
				shippingDataset = dataset;
				maxShippingTimestamp = dataset.maxTimestamp > 0 ? dataset.maxTimestamp : 0;
				unitsPerMillisecond = maxShippingTimestamp > 0 ? maxShippingTimestamp / SHIP_LOOP_DURATION_MS : 0;
				if (!baseTripsLayer || force) {
					baseTripsLayer = createBaseTripsLayer(dataset);
				}
				if (maxShippingTimestamp > 0 && shippingCurrentTime >= maxShippingTimestamp) {
					shippingCurrentTime = shippingCurrentTime % maxShippingTimestamp;
				}
				const shouldReset = !wasActive || force;
				updateShippingLayer();
				shippingActive = true;
				updateShippingDisplay();
				if (!shippingPaused) {
					startShippingAnimation(shouldReset);
				}
			})
			.catch((error) => {
				console.error('Failed to activate shipping layer', error);
			})
			.finally(() => {
				shippingActivationPromise = null;
			});
		await shippingActivationPromise;
	}

	function cleanup() {
		unsubscribeTheme?.();
		unsubscribeSensor?.();
		unsubscribeTheme = undefined;
		unsubscribeSensor = undefined;
		deactivateShippingLayer();
		if (deckOverlay && map) {
			map.removeControl(deckOverlay);
			deckOverlay.finalize?.();
		}
		deckOverlay = null;
		baseTripsLayer = null;
		shippingDataset = null;
		shippingActivationPromise = null;
		maxShippingTimestamp = 0;
		unitsPerMillisecond = 0;
		shippingCurrentTime = 0;
		lastAnimationTimestamp = 0;
		lastProgressBucket = -1;
		animationHandle = null;
		animationRunning = false;
		shippingActive = false;
		shippingPaused = false;
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
		<div class="map-gradient-overlay"></div>
	{/if}

	{#if mode === 'intro' && showEnterButton}
		<div class="enter-overlay" transition:fade={{ duration: ENTER_TRANSITION_DURATION }}>
		<div class="flex flex-col items-center gap-6">
        <h1 class="text-8xl font-semibold font-mono text-text-primary">Ocean Records</h1>
				<h5 class="text-text-primary font-mono text-2xl">Biophony & Anthrophony in Monterey Bay</h5>
		</div>
			<button class="enter-button flex align-center" type="button" on:click={handleEnterClick}>
				Explore <iconify-icon icon="mdi:arrow-right"></iconify-icon>
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
					<h1 class="text-2xl text-text-primary">Ocean</h1>
					<h1 class="text-2xl font-semibold text-text-primary">Records</h1>
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

	{#if mode === 'sidebar' && shippingActive && !$selectedDay}
		<div class="shipping-controls text-text-primary">
			{#if shippingDisplayText}
				<span class="shipping-timestamp">
					{shippingPaused ? '' : ''}
					{shippingDisplayText}
				</span>
			{/if}
			<button class="shipping-toggle" type="button" on:click={toggleShippingAnimation}>
				{shippingPaused ? 'Resume' : 'Pause'}
			</button>
		</div>
	{/if}
</div>

<style>
	.map-root {
		position: relative;
		width: 100%;
		height: 100vh;
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
		/* padding-top: calc(100% / 3); */
		pointer-events: none;
		gap: 30rem;
	}

	.enter-button {
		pointer-events: auto;
		padding: 0.75rem 2.5rem;
		border-radius: 10em;
		border: none;
		font-size: 1rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		background: var(--accent);
		color: var(--text-on-accent, #fff);
		/* box-shadow: var(--shadow-elevated, 0 12px 24px rgba(0, 0, 0, 0.18)); */
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
		/* padding: 0.75rem 1rem; */
		border-radius: 0.75rem;
		/* backdrop-filter: blur(12px);
		border: 1px solid var(--border-subtle);
		min-width: 12rem; */
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

	.shipping-controls {
		position: absolute;
		bottom: 2.5rem;
		left: 1rem;
		right: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem;
		pointer-events: none;
		z-index: 10;
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
		/* font-size: clamp(1.75rem, 3vw, 2.75rem); */
		/* letter-spacing: -0.01em; */
		color: var(--text-primary);
	}

	.shipping-toggle {
		pointer-events: auto;
		background: transparent;
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.2));
		border-radius: 999px;
		padding: 0.35rem 1rem;
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-primary, #fff);
		cursor: pointer;
		transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
	}

	.shipping-toggle:hover {
		background: var(--text-primary, #fff);
		color: var(--background, #000);
		border-color: transparent;
	}

	.shipping-toggle:focus-visible {
		outline: 2px solid var(--accent, #fff);
		outline-offset: 4px;
	}

	.shipping-timestamp {
		flex: 1;
		font-size: 0.75rem;
		font-family: var(--font-mono, monospace);
		pointer-events: none;
	}

	/* .sensor-subtitle {
		margin: 0.125rem 0 0;
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--text-secondary);
	} */

	:global(.cursor-pointer) {
		cursor: pointer !important;
	}
</style>