<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initializeTheme } from '$lib/state/theme';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		initializeTheme();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Ocean Records</title>
</svelte:head>

<div class="app-shell flex min-h-screen flex-col bg-surface-1 text-text-primary transition-colors duration-200">
	<main class="flex-1">
		{@render children?.()}
	</main>
</div>
