<script lang="ts">
	import { goBack } from '$lib/state/navigation';
</script>

<button
	type="button"
	on:click={goBack}
	class="back-button"
	aria-label="Go back"
>
	<span aria-hidden="true">←</span>
</button>

<style>
	.back-button {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid var(--border-subtle);
		background: var(--surface-2);
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.back-button:hover {
		background: var(--surface-1);
		transform: translateX(-2px);
	}

	.back-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.back-button span:first-child {
		font-size: 1rem;
	}
</style>
