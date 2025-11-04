<script lang="ts">
	import { theme, setTheme } from '$lib/state/theme';
	import type { ThemeId } from '$lib/state/theme';

	$: currentTheme = $theme;

	function handleThemeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		setTheme(target.value as ThemeId);
	}
</script>

<div class="theme-toggle-container">
	<div class="toggle-group">
		<!-- Dark -->
		<input
			type="radio"
			name="theme"
			id="dark"
			value="dark"
			checked={currentTheme === 'dark'}
			on:change={handleThemeChange}
		/>
		<label for="dark" title="Dark theme">
			<span aria-hidden="true"><iconify-icon icon="lucide:moon"></iconify-icon></span>
		</label>

		<!-- Blue -->
		<input
			type="radio"
			name="theme"
			id="blue"
			value="blue"
			checked={currentTheme === 'blue'}
			on:change={handleThemeChange}
		/>
		<label for="blue" title="Blue theme">
			<span aria-hidden="true"><iconify-icon icon="ic:round-water"></iconify-icon></span>
		</label>

		<!-- Light -->
		<input
			type="radio"
			name="theme"
			id="light"
			value="light"
			checked={currentTheme === 'light'}
			on:change={handleThemeChange}
		/>
		<label for="light" title="Light theme">
			<span aria-hidden="true"><iconify-icon icon="lucide:sun"></iconify-icon></span>
		</label>
		<span class="selection-indicator" aria-hidden="true"></span>
	</div>
</div>

<style>
	.theme-toggle-container {
		position: fixed;
		top: 1.5rem;
		right: 4rem;
		z-index: 2;
	}

	.toggle-group {
		position: relative;
		display: inline-flex;
		background: var(--surface-1);
		border: 1.5px solid var(--border-subtle);
		padding: 0.125rem;
		gap: 0.125rem;
		height: 2rem;
	}

	/* Hide radio inputs */
	input[type='radio'] {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	/* Each theme option */
	label {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 100%;
		cursor: pointer;
		color: var(--text-secondary);
		transition: color 0.2s ease;
		z-index: 1;
	}

	label:hover {
		color: var(--accent);
	}

	input:checked + label {
		color: var(--text-primary);
	}

	input:focus-visible + label {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	label iconify-icon {
		font-size: 0.875rem;
	}

	/* Sliding background indicator */
	.selection-indicator {
		position: absolute;
		top: 0.125rem;
		left: 0.125rem;
		width: 2rem;
		height: calc(100% - 0.25rem);
		background: var(--accent);
		border: 1px solid var(--border-subtle);
		transition: transform 0.25s ease-out;
		z-index: 0;
	}

	/* Move indicator based on selection */
	input[id='dark']:checked ~ .selection-indicator {
		transform: translateX(0);
	}

	input[id='blue']:checked ~ .selection-indicator {
		transform: translateX(2.125rem); /* 2rem width + 0.125rem gap */
	}

	input[id='light']:checked ~ .selection-indicator {
		transform: translateX(4.25rem); /* (2rem width + 0.125rem gap) × 2 */
	}

	@media (prefers-reduced-motion: reduce) {
		.selection-indicator {
			transition: none;
		}
	}
</style>
