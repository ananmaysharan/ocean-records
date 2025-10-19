import { derived, get, writable } from 'svelte/store';

export type ViewId = 'intro' | 'year' | 'month' | 'day';

export interface DaySelection {
	/** Optional ISO date string or Date instance for the selected day */
	time?: string | Date;
	[key: string]: unknown;
}

export type SelectedDay = DaySelection | null;

const currentView = writable<ViewId>('intro');
const selectedSensor = writable<string>('sensor-01');
const selectedYear = writable<number | null>(null);
const selectedMonth = writable<number | null>(null);
const selectedDay = writable<SelectedDay>(null);

const canGoBack = derived(currentView, ($currentView) => $currentView !== 'intro');

export function goToIntro(): void {
	currentView.set('intro');
	selectedYear.set(null);
	selectedMonth.set(null);
	selectedDay.set(null);
}

export function goToYear(year?: number | null): void {
	currentView.set('year');
	if (year !== undefined) {
		selectedYear.set(year);
	}
	selectedMonth.set(null);
	selectedDay.set(null);
}

export function setYear(year: number | null): void {
	selectedYear.set(year);
}

export function goToMonth(monthIndex: number, options: { year?: number | null } = {}): void {
	selectedMonth.set(monthIndex);
	if (options.year !== undefined) {
		selectedYear.set(options.year);
	}
	currentView.set('month');
	selectedDay.set(null);
}

export function goToDay(dayData: DaySelection & { year?: number | null }): void {
	if (dayData.year !== undefined) {
		selectedYear.set(dayData.year);
	}
	selectedDay.set(dayData);
	currentView.set('day');
}

export function goBack(): void {
	switch (get(currentView)) {
		case 'day':
			currentView.set('month');
			selectedDay.set(null);
			break;
		case 'month':
			currentView.set('year');
			selectedMonth.set(null);
			break;
		case 'year':
			currentView.set('intro');
			selectedYear.set(null);
			break;
		default:
			break;
	}
}

export const navigation = {
	currentView,
	selectedSensor,
		selectedYear,
	selectedMonth,
	selectedDay,
	canGoBack,
	goToIntro,
	goToYear,
		setYear,
	goToMonth,
	goToDay,
	goBack
} as const;

export {
	currentView,
	selectedSensor,
		selectedYear,
	selectedMonth,
	selectedDay,
	canGoBack
};
