# Agent Instructions for mde-data-vis

## Commands
- **Dev**: `npm run dev` (or `npm run dev -- --open` to auto-open browser)
- **Build**: `npm run build`
- **Type check**: `npm run check` (or `npm run check:watch` for watch mode)
- **Preview production build**: `npm run preview`

## Architecture
- **Framework**: SvelteKit 2.x with Svelte 5, TypeScript/JavaScript enabled, Vite bundler
- **Styling**: Tailwind CSS 4.x (via @tailwindcss/vite)
- **Key libraries**: deck.gl, mapbox-gl/maplibre-gl (maps), d3 (data viz), three.js/threlte (3D), p5.js, GSAP (animations), @turf/turf (geospatial)
- **Structure**: `src/routes/` (SvelteKit pages), `src/lib/` (reusable components, state, utils, types, data)
- **State management**: Svelte stores in `src/lib/state/` (navigation, theme, audio)
- **Data visualization views**: YearView, MonthView, DayView components with coordinated navigation

## Code Style
- **TypeScript**: Use `.ts` for logic files; `<script lang="ts">` in Svelte components when needed
- **Imports**: Use `$lib` alias for internal modules (e.g., `import { MapView } from '$lib'`)
- **Naming**: camelCase for variables/functions, PascalCase for components, kebab-case for files
- **Types**: Define interfaces for complex data structures (see `src/lib/types/`)
- **State**: Use Svelte stores for shared state; export store instances and helper functions from state modules
