import type { TripsLayerProps } from '@deck.gl/geo-layers';

export interface ShippingTrip {
	readonly path: [number, number][];
	readonly timestamps: number[];
	readonly vendor?: string;
}

export interface ShippingTripsDataset {
	readonly trips: ShippingTrip[];
	readonly maxTimestamp: number;
}

export const SHIP_COLOR_RGBA: [number, number, number, number] = [228, 64, 0, 255];

let datasetPromise: Promise<ShippingTripsDataset> | null = null;

const IDLE_SCHEDULER: ((cb: () => void) => void) | null =
	typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function'
		? (callback) => (window as any).requestIdleCallback(() => callback())
		: typeof window !== 'undefined'
			? (callback) => window.setTimeout(callback, 0)
			: null;

interface RawShippingTrip {
	vendor?: string;
	path?: unknown;
	timestamps?: unknown;
}

function isCoordinateTuple(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		value.every((item) => typeof item === 'number' && Number.isFinite(item))
	);
}

function toTrip(raw: RawShippingTrip): ShippingTrip | null {
	if (!raw || !Array.isArray(raw.path) || !Array.isArray(raw.timestamps)) return null;
	const path = raw.path.filter(isCoordinateTuple) as [number, number][];
	const timestamps = raw.timestamps.filter((value): value is number =>
		typeof value === 'number' && Number.isFinite(value)
	);
	if (path.length < 2 || timestamps.length !== path.length) return null;
	return {
		vendor: raw.vendor,
		path,
		timestamps
	};
}

function transformTrips(rawTrips: RawShippingTrip[]): ShippingTripsDataset {
	let maxTimestamp = 0;
	const trips: ShippingTrip[] = [];

	for (const raw of rawTrips) {
		const trip = toTrip(raw);
		if (!trip) continue;
		const endTimestamp = trip.timestamps[trip.timestamps.length - 1] ?? 0;
		if (endTimestamp > maxTimestamp) {
			maxTimestamp = endTimestamp;
		}
		trips.push(trip);
	}

	return { trips, maxTimestamp };
}

async function importTrips(): Promise<ShippingTripsDataset> {
	const module = await import('$lib/assets/shipping_2020_expanded_trips.json');
	const raw = module.default as RawShippingTrip[];
	return transformTrips(raw);
}

export function loadShippingTrips(): Promise<ShippingTripsDataset> {
	if (!datasetPromise) {
		datasetPromise = new Promise<ShippingTripsDataset>((resolve, reject) => {
			const load = () => {
				importTrips().then(resolve).catch(reject);
			};

			if (IDLE_SCHEDULER) {
				IDLE_SCHEDULER(load);
			} else {
				load();
			}
		});
	}
	return datasetPromise;
}

export function preloadShippingTrips(): void {
	if (!datasetPromise) {
		void loadShippingTrips();
	}
}

export type TripsLayerFactory = (
	options: Partial<Pick<TripsLayerProps<ShippingTrip>, 'currentTime'>>
) => TripsLayerProps<ShippingTrip>;
