<script lang="ts">
    import { MapView, MonthView, YearView, DayView } from '$lib';
    import { currentView, goToYear } from '$lib/state/navigation';
    import { fade } from 'svelte/transition';
    import ThemeToggle from '$lib/ThemeToggle.svelte';

    let introComplete = false;
    let showMonthView = false;
    let monthTransitionDelay = 0;
    let monthTimeoutId: ReturnType<typeof setTimeout> | null = null;
    
    $: showContent = $currentView !== 'intro' && introComplete;
    $: showYearView = $currentView === 'year' || $currentView === 'month';
    $: showDayView = $currentView === 'day';
    
    // Delay showing month view to allow year view animation to complete
    $: if ($currentView === 'month') {
        // Wait for FLIP animation to complete (500ms duration + 0.02 stagger * items)
        // Adding 200ms buffer for smooth transition
        monthTransitionDelay = 2000;
        if (monthTimeoutId) {
            clearTimeout(monthTimeoutId);
        }
        monthTimeoutId = setTimeout(() => {
            showMonthView = true;
            monthTimeoutId = null;
        }, monthTransitionDelay);
    } else {
        if (monthTimeoutId) {
            clearTimeout(monthTimeoutId);
            monthTimeoutId = null;
        }
        showMonthView = false;
    }
    
    function handleIntroComplete() {
        // Delay showing content slightly to prevent flash during transition
        setTimeout(() => {
            introComplete = true;
            goToYear();
        }, 200);
    }
</script>

<ThemeToggle />

<section class="stage" class:has-content={showContent}>
    <div class="map-pane">
        <MapView 
            mode={$currentView === 'intro' ? 'intro' : 'sidebar'}
            onIntroComplete={handleIntroComplete}
        />
    </div>
    
    {#if showContent}
        <div
            class="content-pane"
            class:show-month={showMonthView}
            class:show-day={showDayView}
        >
            {#if showYearView}
                <div class="year-wrapper">
                    <YearView />
                </div>
            {/if}
            {#if showMonthView}
                <div class="month-wrapper">
                    <MonthView />
                </div>
            {/if}
            {#if showDayView}
                <div class="day-wrapper">
                    <DayView />
                </div>
            {/if}
        </div>
    {/if}
</section>

<style>
    .stage {
        min-height: calc(100vh - 4rem);
        display: flex;
    }

    .stage.has-content {
        gap: 1.5rem;
    }

    .map-pane {
        flex: 1;
        position: relative;
		z-index: 2;
    }

    .stage.has-content .map-pane {
        flex: 1;
    }

    .content-pane {
        flex: 3;
        overflow-y: auto;
        /* padding: 1.5rem; */
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .content-pane.show-month {
        gap: 2rem;
    }

    .content-pane.show-day {
        gap: 2rem;
    }

    .year-wrapper {
        flex-shrink: 0;
        transition: margin-bottom 0.3s ease;
    }

    .content-pane.show-month .year-wrapper {
        margin-bottom: 0;
    }

    .month-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
        opacity: 0;
        animation: fadeIn 0.3s ease forwards;
        margin: 0 1rem;
    }

    .day-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .month-wrapper :global(section.month-view) {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
</style>