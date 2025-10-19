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
		display: inline-flex;
		border-radius: 0.25rem;
		background: var(--surface-1);
		backdrop-filter: blur(12px);
		height: 2rem;
		width: auto;
		padding: 0.125rem;
		gap: 0.125rem;
		transition: all 0.2s ease;
		border: 1px solid var(--border-subtle);
	}

	.toggle-group input[type='radio'] {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.toggle-group label {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 0.5rem;
		cursor: pointer;
		color: var(--text-secondary);
		background: transparent;
		transition: all 0.2s ease;
		border-radius: 0.125rem;
		min-width: 2rem;
		height: 100%;
	}

	.toggle-group label:hover {
		background: var(--accent);
		color: var(--text-primary);
	}

	.toggle-group input[type='radio']:checked + label {
		background: var(--accent);
		color: var(--text-primary);
		font-weight: 600;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.toggle-group input[type='radio']:focus-visible + label {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
		z-index: 1;
	}

	.toggle-group label iconify-icon {
		font-size: 0.875rem;
	}
</style>
