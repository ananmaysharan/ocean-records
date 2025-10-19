import { csvParse } from 'd3-dsv';
import sensorsGeo from '$lib/assets/sensors.geo.json';

export const SOUND_TYPE_COLORS = {
	ships: '#E44000',
	explosions: '#FE7C1F',
	bluewhale: '#73CBE9',
	finwhale: '#E5AA00',
	humpbackwhale: '#E656E1',
	dolphins: '#81C995',
	bocaccio: '#9F6FF8',
	plainfinmidshipman: '#81C995',
} as const;

export type SoundType = keyof typeof SOUND_TYPE_COLORS;

export const METRIC_COLUMNS = [
	'sonar',
	'bluewhale',
	'humpbackwhale',
	'ships',
	'bocaccio',
	'plainfinmidshipman',
	'explosions',
	'dolphins',
	'finwhale'
] as const;

export type MetricKey = (typeof METRIC_COLUMNS)[number];

type CsvRow = Record<string, string>;

export interface MonthSummaryEntry {
	readonly date: Date;
	readonly isoDate: string;
	readonly values: Record<MetricKey, number | null>;
}

export interface DaySummaryEntry {
	readonly date: Date;
	readonly isoDay: string;
	readonly values: Record<MetricKey, number | null>;
}

export interface HourSummaryEntry {
	readonly date: Date;
	readonly isoDay: string;
	readonly hour: number;
	readonly values: Record<MetricKey, number | null>;
}

export interface SensorMetadata {
	id: string;
	label: string;
	index: number;
	coordinates: [number, number];
	popupHtml?: string | null;
}

const SENSOR_ID_PREFIX = 'sensor-';

export const SENSOR_METADATA: SensorMetadata[] = sensorsGeo.features.map((feature, index) => ({
	id: `${SENSOR_ID_PREFIX}${String(index + 1).padStart(2, '0')}`,
	label: feature.properties?.label ?? `Sensor ${index + 1}`,
	index,
	coordinates: feature.geometry?.coordinates as [number, number],
	popupHtml: feature.properties?.popup ?? null
}));

export type SensorId = (typeof SENSOR_METADATA)[number]['id'];

// Mapping from sensor IDs to folder names
const SENSOR_FOLDER_MAP: Record<string, string> = {
	'sensor-01': 'mb01',
	'sensor-02': 'mb02',
	'sensor-03': 'mb03'
};

// Cache data per sensor
const monthSummaryCache = new Map<string, Promise<MonthSummaryEntry[]>>();

interface DayDataset {
	entries: DaySummaryEntry[];
	byMonth: Map<string, DaySummaryEntry[]>;
	byDate: Map<string, DaySummaryEntry>;
}

const dayDatasetCache = new Map<string, Promise<DayDataset>>();

interface HourDataset {
	entries: HourSummaryEntry[];
	byDay: Map<string, HourSummaryEntry[]>;
}

const hourDatasetCache = new Map<string, Promise<HourDataset>>();

let tripsPromise: Promise<unknown> | null = null;

function parseValue(value?: string): number | null {
	if (value === undefined) return null;
	const text = value.trim();
	if (!text || text.toLowerCase() === 'null') return null;
	const next = Number(text);
	return Number.isNaN(next) ? null : next;
}

function parseDate(value?: string): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function getTimeField(row: CsvRow): string | undefined {
	return row.time ?? row['time '] ?? row.Time ?? row['Time'];
}

function pad(value: number): string {
	return value.toString().padStart(2, '0');
}

function toIsoDay(date: Date): string {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseMonthCsv(raw: string): MonthSummaryEntry[] {
	const parsed = csvParse(raw.trim()) as CsvRow[];
	return parsed
		.map((row) => {
			const date = parseDate(getTimeField(row));
			if (!date) return null;
			const values: Record<MetricKey, number | null> = {} as Record<MetricKey, number | null>;
			for (const key of METRIC_COLUMNS) {
				values[key] = parseValue(row[key]);
			}
			return {
				date,
				isoDate: date.toISOString(),
				values
			};
		})
		.filter(Boolean) as MonthSummaryEntry[];
}

function buildDayDataset(raw: string): DayDataset {
	const parsed = csvParse(raw.trim()) as CsvRow[];
	const entries: DaySummaryEntry[] = [];
	const byMonth = new Map<string, DaySummaryEntry[]>();
	const byDate = new Map<string, DaySummaryEntry>();

	for (const row of parsed) {
		const date = parseDate(getTimeField(row));
		if (!date) continue;
		const isoDay = toIsoDay(date);
		const values: Record<MetricKey, number | null> = {} as Record<MetricKey, number | null>;
		for (const key of METRIC_COLUMNS) {
			values[key] = parseValue(row[key]);
		}
		const entry: DaySummaryEntry = { date, isoDay, values };
		entries.push(entry);

		const monthKey = `${date.getUTCFullYear()}-${pad(date.getUTCMonth())}`;
		if (!byMonth.has(monthKey)) {
			byMonth.set(monthKey, []);
		}
		byMonth.get(monthKey)!.push(entry);
		if (!byDate.has(isoDay)) {
			byDate.set(isoDay, entry);
		}
	}

	return { entries, byMonth, byDate };
}

function buildHourDataset(raw: string): HourDataset {
	const parsed = csvParse(raw.trim()) as CsvRow[];
	const entries: HourSummaryEntry[] = [];
	const byDay = new Map<string, HourSummaryEntry[]>();

	for (const row of parsed) {
		const date = parseDate(getTimeField(row));
		if (!date) continue;
		const isoDay = toIsoDay(date);
		const values: Record<MetricKey, number | null> = {} as Record<MetricKey, number | null>;
		for (const key of METRIC_COLUMNS) {
			values[key] = parseValue(row[key]);
		}
		const entry: HourSummaryEntry = {
			date,
			isoDay,
			hour: date.getUTCHours(),
			values
		};
		entries.push(entry);

		if (!byDay.has(isoDay)) {
			byDay.set(isoDay, []);
		}
		byDay.get(isoDay)!.push(entry);
	}

	for (const [, hours] of byDay) {
		hours.sort((a, b) => a.date.getTime() - b.date.getTime());
	}

	return { entries, byDay };
}

function getSensorFolder(sensorId?: SensorId): string {
	if (!sensorId) return 'mb01'; // Default to mb01
	return SENSOR_FOLDER_MAP[sensorId] || 'mb01';
}

export async function getMonthSummary(sensorId?: SensorId): Promise<MonthSummaryEntry[]> {
	const folder = getSensorFolder(sensorId);
	
	if (!monthSummaryCache.has(folder)) {
		const promise = import(`$lib/assets/${folder}/month_level_summary.csv?raw`)
			.then(({ default: raw }) => parseMonthCsv(raw))
			.catch((error) => {
				console.error(`Failed to load month summary for ${folder}`, error);
				return [];
			});
		monthSummaryCache.set(folder, promise);
	}
	return monthSummaryCache.get(folder)!;
}

export async function getDaySummary(
	sensorId: SensorId | undefined,
	monthIndex: number,
	options: { year?: number } = {}
): Promise<DaySummaryEntry[]> {
	const dataset = await loadDayDataset(sensorId);
	const year = options.year ?? 2020;
	const key = `${year}-${pad(monthIndex)}`;
	return dataset.byMonth.get(key) ?? [];
}

export async function getDaySummaryByDate(
	sensorId: SensorId | undefined,
	isoDay: string
): Promise<DaySummaryEntry | undefined> {
	const dataset = await loadDayDataset(sensorId);
	return dataset.byDate.get(isoDay);
}

export async function getHourSummary(
	sensorId: SensorId | undefined,
	date: Date
): Promise<HourSummaryEntry[]> {
	const dataset = await loadHourDataset(sensorId);
	const isoDay = toIsoDay(date);
	return dataset.byDay.get(isoDay) ?? [];
}


async function loadDayDataset(sensorId?: SensorId): Promise<DayDataset> {
	const folder = getSensorFolder(sensorId);
	
	if (!dayDatasetCache.has(folder)) {
		const promise = import(`$lib/assets/${folder}/day_level_summary.csv?raw`)
			.then(({ default: raw }) => buildDayDataset(raw))
			.catch((error) => {
				console.error(`Failed to load day dataset for ${folder}`, error);
				return { entries: [], byMonth: new Map(), byDate: new Map() };
			});
		dayDatasetCache.set(folder, promise);
	}
	return dayDatasetCache.get(folder)!;
}

async function loadHourDataset(sensorId?: SensorId): Promise<HourDataset> {
	const folder = getSensorFolder(sensorId);
	
	if (!hourDatasetCache.has(folder)) {
		const promise = import(`$lib/assets/${folder}/hour_level_summary.csv?raw`)
			.then(({ default: raw }) => buildHourDataset(raw))
			.catch((error) => {
				console.error(`Failed to load hour dataset for ${folder}`, error);
				return { entries: [], byDay: new Map() };
			});
		hourDatasetCache.set(folder, promise);
	}
	return hourDatasetCache.get(folder)!;
}
