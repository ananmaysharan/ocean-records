export type ValueStatus = 'missing' | 'zero' | 'detect';

export interface HourDatum {
	hour: number;
	ships: ValueStatus;
	explosions: ValueStatus;
	blue: ValueStatus;
	bocaccio: ValueStatus;
	dolphins: ValueStatus;
}

export interface PillDatum {
	hour: number;
	activeRows: Array<{ key: string; y: number; color: string }>;
}

export interface DayCardPreviewData {
	isoDay: string;
	label: string;
	dayNumber: string;
	humpback: ValueStatus;
	fin: ValueStatus;
	hours: HourDatum[];
	pills: PillDatum[];
	hasData: boolean;
}
