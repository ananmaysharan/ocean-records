<script>
    // @ts-nocheck
    import { tick } from 'svelte';
    import { fade } from 'svelte/transition';
    import gsap from 'gsap';
    import { onMount, onDestroy } from 'svelte';
    import { select } from 'd3-selection';
    import LegendItem from '../LegendItem.svelte';
    import LegendGraphic from '../components/LegendGraphic.svelte';
    import { getMonthSummary } from '$lib/data';
    import { selectedSensor, selectedMonth, selectedYear, goToMonth, setYear } from '$lib/state/navigation';
    import { get } from 'svelte/store';
    import { playSound, stopSound, stopAllSounds } from '$lib/utils/soundEffects';
    import { setSoundHighlight, clearSoundHighlight } from '$lib/state/audio';

    let Flip;
    let data = [];
    let layout = 'grid';
    let containerEl;
    let flipState = null;
    let tooltipSelection;
    let monthTooltipSelection;
    let unsubscribeSensor;
    let showLabels = true;
    let legendVariant = 'year';
    let fadeOutLabels = false;
    let activeCircleElement = null;
    let activeCircleSoundType = null;

    const colors = {
        ships: '#E44000',
        explosions: '#FE7C1F',
        bluewhale: '#73CBE9',
        finwhale: '#E5AA00',
        humpbackwhale: '#E656E1',
        dolphins: '#81C995',
        bocaccio: '#9F6FF8',
        plainfinmidshipman: '#81C995',
    };

    const soundTypes = ['ships', 'explosions', 'bluewhale', 'finwhale', 'humpbackwhale', 'bocaccio', 'dolphins'];

    const displayNames = {
        ships: 'Ship',
        bluewhale: 'Blue Whale',
        finwhale: 'Fin Whale',
        humpbackwhale: 'Humpback',
        dolphins: 'Dolphin',
        bocaccio: 'Boccacio',
        explosions: 'Explosion'
    };

    onMount(async () => {
        const FlipModule = await import('gsap/Flip');
        Flip = FlipModule.default;
        gsap.registerPlugin(Flip);
        await loadData(get(selectedSensor));
        unsubscribeSensor = selectedSensor.subscribe((sensorId) => {
            loadData(sensorId);
        });
    });

    onDestroy(() => {
        tooltipSelection?.remove();
        tooltipSelection = null;
        monthTooltipSelection?.remove();
        monthTooltipSelection = null;
        unsubscribeSensor?.();
        stopAllSounds();
        activeCircleElement = null;
        activeCircleSoundType = null;
        clearSoundHighlight();
    });

    async function loadData(sensorId) {
        try {
            const entries = await getMonthSummary(sensorId);
            data = entries
                .slice()
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map((entry) => {
                    const record = { time: entry.isoDate };
                    for (const soundType of soundTypes) {
                        record[soundType] = entry.values[soundType] ?? null;
                    }
                    return record;
                });
            // layout = 'grid';
            hideTooltip();
            stopAllSounds();
            activeCircleElement = null;
            activeCircleSoundType = null;
            clearSoundHighlight();
        } catch (error) {
            console.error('Failed to load month summary', error);
            data = [];
        }
    }

    function ensureTooltip() {
        if (tooltipSelection) {
            return tooltipSelection;
        }
        tooltipSelection = select('body')
            .append('div')
            .attr('class', 'circle-tooltip hidden')
            .style('position', 'fixed')
            .style('pointer-events', 'none')
            .style('left', '0px')
            .style('top', '0px');
        return tooltipSelection;
    }

    function formatDetectionValue(value) {
        if (value === null || value === undefined) {
            return 'No data';
        }
        if (value === 0) {
            return '0 detections';
        }
        if (Number.isFinite(value)) {
            return `${value.toLocaleString()} detections`;
        }
        return 'No data';
    }

    function formatDate(value) {
        const date = new Date(value);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' });
    }

    function formatMonthLabel(value) {
        const date = new Date(value);
        const month = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' }).toUpperCase();
        const year = date.getUTCFullYear().toString()
        return `${month} ${year}`;
    }

    function moveTooltip(event) {
        if (layout !== 'grid') return;
        const tooltip = ensureTooltip();
        const offset = 14;
        const tooltipWidth = 192; // max-width: 12rem = 192px
        const viewportWidth = window.innerWidth;
        
        // Check if tooltip would overflow on the right side
        const wouldOverflowRight = event.clientX + offset + tooltipWidth > viewportWidth;
        
        if (wouldOverflowRight) {
            // Position tooltip to the left of the cursor
            tooltip
                .style('left', `${event.clientX - offset}px`)
                .style('top', `${event.clientY + offset}px`)
                .style('transform', 'translateX(-100%)');
        } else {
            // Position tooltip to the right of the cursor (default)
            tooltip
                .style('left', `${event.clientX + offset}px`)
                .style('top', `${event.clientY + offset}px`)
                .style('transform', null);
        }
    }

    function showTooltip(event, soundType, value, label) {
        if (layout !== 'grid') return;
        const tooltip = ensureTooltip();
        const displayName = displayNames[soundType] || soundType;
        tooltip
            .classed('hidden', false)
            .html(`<span class="tooltip-label">${displayName}</span><span class="tooltip-value">${formatDetectionValue(value)}</span>`);
        moveTooltip(event);
    }

    function hideTooltip() {
        tooltipSelection?.classed('hidden', true);
    }

    function ensureMonthTooltip() {
        if (monthTooltipSelection) {
            return monthTooltipSelection;
        }
        monthTooltipSelection = select('body')
            .append('div')
            .attr('class', 'month-tooltip hidden')
            .style('position', 'fixed')
            .style('pointer-events', 'none')
            .style('left', '0px')
            .style('top', '0px');
        return monthTooltipSelection;
    }

    function moveMonthTooltip(event) {
        const tooltip = ensureMonthTooltip();
        const offset = 14;
        const tooltipWidth = 192;
        const viewportWidth = window.innerWidth;
        
        const wouldOverflowRight = event.clientX + offset + tooltipWidth > viewportWidth;
        
        if (wouldOverflowRight) {
            tooltip
                .style('left', `${event.clientX - offset}px`)
                .style('top', `${event.clientY + offset}px`)
                .style('transform', 'translateX(-100%)');
        } else {
            tooltip
                .style('left', `${event.clientX + offset}px`)
                .style('top', `${event.clientY + offset}px`)
                .style('transform', null);
        }
    }

    function showMonthTooltip(event, monthLabel) {
        if (layout !== 'row') return;
        const tooltip = ensureMonthTooltip();
        tooltip
            .classed('hidden', false)
            .html(`<span class="tooltip-label">${monthLabel}</span>`);
        moveMonthTooltip(event);
    }

    function hideMonthTooltip() {
        monthTooltipSelection?.classed('hidden', true);
    }

    function handleCircleEnter(event, soundType, value, label) {
        if (layout !== 'grid') return;
        activeCircleElement = event.currentTarget;
        activeCircleSoundType = soundType;
        playSound(soundType);
        setSoundHighlight(soundType);
        showTooltip(event, soundType, value, label);
    }

    function handleCircleMove(event) {
        moveTooltip(event);
    }

    function handleCircleLeave(event, soundType) {
        if (activeCircleElement === event.currentTarget && activeCircleSoundType === soundType) {
            activeCircleElement = null;
            activeCircleSoundType = null;
            stopSound(soundType);
            clearSoundHighlight();
        }
        hideTooltip();
    }

    function handleMonthGroupEnter(event, monthTime) {
        if (layout !== 'row') return;
        const monthLabel = formatDate(monthTime);
        showMonthTooltip(event, monthLabel);
    }

    function handleMonthGroupMove(event) {
        if (layout !== 'row') return;
        moveMonthTooltip(event);
    }

    function handleMonthGroupLeave() {
        hideMonthTooltip();
    }

    function getCircleProps(value) {
        if (value === null || value === undefined || value === '') {
            return { size: 8, color: '#eee', value: null, opacity: 0 };
        }
        const numValue = Number(value);
        if (!Number.isFinite(numValue)) {
            return { size: 8, color: '#eee', value: null, opacity: 0 };
        }
        if (numValue === 0) {
            return { size: 8, color: null, value: 0, opacity: 0.2 };
        }
        const size = Math.min(8 + Math.sqrt(numValue), 40);
        return { size, color: null, value: numValue, opacity: 1 };
    }

    function prepareFlipState() {
        const items = containerEl?.querySelectorAll('.month-group');
        if (!items || items.length === 0) {
            return null;
        }
        return Flip ? Flip.getState(items) : null;
    }

    async function changeLayout(nextLayout) {
        if (layout === nextLayout) return;
        
        // Fade out labels when transitioning away from grid
        if (layout === 'grid' && nextLayout === 'row') {
            fadeOutLabels = true;
            // Wait for fade out animation to complete (200ms)
            await new Promise(resolve => setTimeout(resolve, 200));
            showLabels = false;
            fadeOutLabels = false;
        }
        
        flipState = prepareFlipState();
        layout = nextLayout;
    }

    function handleMonthGroupActivate(event) {
        const row = getRowFromEvent(event);
        if (!row) return;
        changeLayout('row');
        openMonth(row);
    }

    function handleMonthGroupKeydown(event) {
        if (layout === 'row') return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const row = getRowFromEvent(event);
            if (!row) return;
            changeLayout('row');
            openMonth(row);
        }
    }

    function returnToGrid() {
        changeLayout('grid');
    }

    async function animateLayout() {
        await tick();
        if (!flipState || !Flip) {
            flipState = null;
            // Show labels immediately if no animation
            if (layout === 'grid') {
                showLabels = true;
            }
            return;
        }
        
        const animation = Flip.from(flipState, {
            duration: 0.5,
            ease: 'power2.inOut',
            stagger: 0.02,
            prune: true,
            absolute: true,
            nested: true,
            toggleClass: 'flipping',
            onComplete: () => {
                // Show labels after animation completes when transitioning to grid
                if (layout === 'grid') {
                    showLabels = true;
                }
            }
        });
        flipState = null;
    }

    $: if (flipState) {
        animateLayout();
    }

    $: if (layout !== 'grid') {
        hideTooltip();
        stopAllSounds();
        activeCircleElement = null;
        activeCircleSoundType = null;
        clearSoundHighlight();
    }

    $: if (layout !== 'row') {
        hideMonthTooltip();
    }

    $: if ($selectedMonth !== null && layout !== 'row') {
        changeLayout('row');
    }

    $: if ($selectedMonth === null && layout !== 'grid') {
        changeLayout('grid');
    }

    $: legendVariant = $selectedMonth !== null ? 'month' : 'year';

    function parseRowDate(row) {
        if (!row || !row.time) return null;
        const date = new Date(row.time);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        return date;
    }

    function openMonth(row) {
        const date = parseRowDate(row);
        if (!date) return;
        setYear(date.getUTCFullYear());
        goToMonth(date.getUTCMonth(), { year: date.getUTCFullYear() });
    }

    function getRowFromEvent(event) {
        const target = event?.currentTarget;
        if (!target) return null;
        const index = Number(target.dataset?.index ?? -1);
        if (Number.isNaN(index) || index < 0 || index >= data.length) {
            return null;
        }
        return data[index];
    }

    function formatMonthYearHeading(year, month) {
        const date = new Date(year, month, 1);
        return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    }
</script>

<div class="legend" aria-label="Sound type legend">
    <div class="legend-items">
        <LegendItem type="ships" status=""/>
        <LegendItem type="explosions" status=""/>
        <LegendItem type="bluewhale" status="Endangered"  />
        <LegendItem type="finwhale" status="Endangered" />
        <LegendItem type="humpbackwhale" status="Threatened" />
        <LegendItem type="bocaccio" status="Vulnerable" />
        <LegendItem type="dolphins" status="Vulnerable" />
    </div>
        <div class="legend-info">
            <LegendGraphic variant={legendVariant} />
        </div>
</div>

<div class="visualization-wrapper">
    <div class="heading-container">
        {#if layout === 'grid'}
            <h1 class="pl-3 font-serif text-md" in:fade={{ duration: 300, delay: 150 }} out:fade={{ duration: 150 }}>Monthly Detections</h1>
        {/if}
        {#if layout === 'row' && $selectedMonth !== null && $selectedYear !== null}
            <h1 class="font-serif text-md" in:fade={{ duration: 300, delay: 150 }} out:fade={{ duration: 150 }}>{formatMonthYearHeading($selectedYear, $selectedMonth)}</h1>
        {/if}
    </div>
    {#if layout === 'row' && $selectedMonth === null}
        <button
            class="back-button"
            type="button"
            on:click={returnToGrid}
            aria-label="Return to grid view">
            Back
        </button>
    {/if}
    <div class="container" bind:this={containerEl} class:row-layout={layout === 'row'}>
        {#each data as row, index}
            <div
                class="month-group"
                class:clickable={layout === 'grid'}
                class:hoverable={layout === 'row'}
                role="button"
                tabindex={layout === 'grid' ? 0 : -1}
                aria-disabled={layout === 'row'}
                aria-label={`Show timeline view for ${row.time}`}
                data-index={index}
                on:click={handleMonthGroupActivate}
                on:keydown={handleMonthGroupKeydown}
                on:mouseenter={(event) => handleMonthGroupEnter(event, row.time)}
                on:mousemove={handleMonthGroupMove}
                on:mouseleave={handleMonthGroupLeave}
            >
                {#if layout === 'grid' && showLabels}
                    <div class="month-label text-xs font-mono" class:fade-out={fadeOutLabels}>{formatMonthLabel(row.time)}</div>
                {/if}
                {#each soundTypes as soundType}
                    {@const props = getCircleProps(row[soundType])}
                    <svg
                        viewBox="0 0 {props.size} {props.size}"
                        width="{props.size}"
                        height="{props.size}"
                        on:mouseenter={(event) => handleCircleEnter(event, soundType, props.value, row.time)}
                        on:mousemove={handleCircleMove}
                        on:mouseleave={(event) => handleCircleLeave(event, soundType)}
                        aria-label={`${soundType} detections: ${props.value ?? 'no data'}`}
                        role="img"
                    >
                        <circle
                            class="blur-blob"
                            r="{props.size / 2}"
                            cx="{props.size / 2}"
                            cy="{props.size / 2}"
                            fill={props.color || colors[soundType]}
                            opacity={props.opacity}
                        />
                    </svg>
                {/each}
            </div>
        {/each}
    </div>
</div>

<style>
    .legend {
        display: flex;
        /* flex-wrap: wrap; */
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
        justify-content: flex-start;
        border-bottom: 1px solid var(--border-subtle);
    }

    .legend-items {
        display: flex;
        /* flex-wrap: wrap; */
        gap: 1rem;
        margin: 0 1rem 0 2rem;
    }

    .legend-info {
        /* margin-left: auto; */
        min-width: 100px;
        margin-top: 3rem;
    }

    .visualization-wrapper {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
        min-height: 200px;
        margin: 0 1rem;
        padding: 1em;
    }

    .heading-container {
        position: relative;
        min-height: 2rem;
        width: 100%;
    }

    .heading-container h1 {
        position: absolute;
        top: 0;
        left: 0;
        margin: 0;
    }

    .container {
        display: grid;
        grid-template-columns: repeat(13, minmax(0, 1fr));
        gap: 1rem 0.5rem;
        transition: all 0.3s ease;
        width: 100%;
    }

    .container.row-layout {
        display: flex;
        flex-wrap: nowrap;
        justify-content: space-between;
        min-height: 150px;
    }

    .month-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 0;
        position: relative;
        padding-top: 1.5rem;
    }

    .month-group.clickable {
        cursor: pointer;
    }

    /*
    .month-group.clickable:hover {
        scale: 1.15;
        transition: 0.3s ease;
    }
    */

    .month-group.clickable:focus-visible {
        outline: 2px solid #222;
        outline-offset: 4px;
    }

    .month-group.clickable svg:hover {
        scale: 1.15;
        transition: 0.3s ease;
        cursor: pointer;
        z-index: 1;
    }

    .month-group.hoverable:hover {
        scale: 1.15;
        transition: scale 0.3s ease;
        cursor: pointer;
    }

    .month-label {
        font-size: 0.6rem;
        font-weight: 600;
        text-align: center;
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: max-content;
        animation: fadeInLabel 0.3s ease-in forwards;
    }

    .month-label.fade-out {
        animation: fadeOutLabel 0.2s ease-out forwards;
    }

    @keyframes fadeInLabel {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes fadeOutLabel {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }

    .blur-blob {
        will-change: transform;
    }

    /* .month-heading {
        align-self: flex-start;
        font-size: 2rem;
        font-weight: 700;
        margin: 0 0 1rem 0;
        color: #222;
    } */

    .back-button {
        align-self: flex-start;
        border: none;
        border-radius: 999px;
        background: #222;
        color: #fff;
        padding: 1em;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
    }

    :global(.circle-tooltip) {
        z-index: 10;
        background: var(--surface-overlay);
        backdrop-filter: blur(12px); /* Blur effect */
        -webkit-backdrop-filter: blur(12px); /* Safari support */
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
        padding: 0.5rem 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        font-size: 0.75rem;
        transition: opacity 0.15s ease;
        opacity: 1;
        max-width: 12rem;
        text-transform: none;
    }

    :global(.circle-tooltip.hidden) {
        opacity: 0;
    }

    :global(.tooltip-label) {
        font-weight: 600;
        text-transform: uppercase;
        font-family: var(--font-mono);
    }

    :global(.tooltip-type) {
        font-size: 0.7rem;
        text-transform: capitalize;
        color: var(--text-secondary);
        font-family: var(--font-serif);
    }

    :global(.tooltip-value) {
        font-size: 0.8rem;
        font-weight: 500;
        line-height: 1.4;
    }

    :global(.month-tooltip) {
        z-index: 10;
        background: var(--surface-overlay);
        backdrop-filter: blur(12px); /* Blur effect */
        -webkit-backdrop-filter: blur(12px); /* Safari support */
        border: 1px solid var(--border-subtle);
        color: var(--text-primary);
        padding: 0.5rem 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        font-size: 0.75rem;
        transition: opacity 0.15s ease;
        opacity: 1;
        max-width: 12rem;
        text-transform: none;
    }

    :global(.month-tooltip.hidden) {
        opacity: 0;
    }

    :global(.month-tooltip .tooltip-label) {
        font-weight: 600;
        text-transform: uppercase;
        font-family: var(--font-mono);
    }
</style>
