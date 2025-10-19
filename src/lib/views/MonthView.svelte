<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    getDaySummary,
    getHourSummary,
    SENSOR_METADATA,
    SOUND_TYPE_COLORS,
    type DaySummaryEntry,
    type HourSummaryEntry,
    type SensorId
  } from '$lib/data';
  import * as d3 from 'd3';
  import { select } from 'd3-selection';
  import {
    goToDay,
    selectedDay,
    selectedMonth,
    selectedSensor,
    selectedYear
  } from '$lib/state/navigation';

  type ValueStatus = 'missing' | 'zero' | 'detect';

  const HOURS_PER_DAY = 24;
  const HUMAN_METRICS = ['ships', 'explosions', 'sonar'] as const;

  const TIMELINE_MARGIN_LEFT = 16;
  const TIMELINE_MARGIN_RIGHT = 16;
  const COLUMN_WIDTH = 26;
  const COLUMN_GAP = 10;
  const TIMELINE_CONTENT_WIDTH =
    HOURS_PER_DAY * COLUMN_WIDTH + (HOURS_PER_DAY - 1) * COLUMN_GAP;
  const VIEWBOX_WIDTH = TIMELINE_CONTENT_WIDTH + TIMELINE_MARGIN_LEFT + TIMELINE_MARGIN_RIGHT;
  const VIEWBOX_HEIGHT = 200;
  const COMPRESSION_OFFSET = 0;
  const VIEWBOX_HEIGHT_COMPRESSED = VIEWBOX_HEIGHT - COMPRESSION_OFFSET;
  const HOUR_CENTER_OFFSET = COLUMN_WIDTH / 2;
  const BAR_WIDTH = TIMELINE_CONTENT_WIDTH;

  const BAR_GAP = 5;
  const circleRadius = COLUMN_WIDTH * 0.45;
  const circleDiameter = circleRadius * 2;
  const BAR_HEIGHT = circleRadius;
  const SHIPS_ROW_Y = 22;
  const EXPLOSIONS_ROW_Y = SHIPS_ROW_Y + circleDiameter + 6;
  const BLUE_ROW_Y = EXPLOSIONS_ROW_Y + circleDiameter + 6;
  const BOCCACCIO_ROW_Y = BLUE_ROW_Y + circleDiameter + 6;
  const DOLPHIN_ROW_Y = BOCCACCIO_ROW_Y + circleDiameter + 6;
  const HUMPBACK_BAR_Y = DOLPHIN_ROW_Y + circleRadius + 4;
  const FIN_BAR_Y = HUMPBACK_BAR_Y + BAR_HEIGHT + BAR_GAP;
  const PILL_VERTICAL_PADDING = circleRadius * 0.28;
  const PILL_WIDTH = 5;

  interface HourDatum {
    hour: number;
    ships: ValueStatus;
    explosions: ValueStatus;
    blue: ValueStatus;
    bocaccio: ValueStatus;
    dolphins: ValueStatus;
  }

  interface PillDatum {
    hour: number;
    activeRows: Array<{ key: string; y: number; color: string }>;
  }

  interface DayCard {
    isoDay: string;
    date: Date;
    label: string;
    dayNumber: string;
    humpback: ValueStatus;
    fin: ValueStatus;
    hours: HourDatum[];
    pills: PillDatum[];
    hasData: boolean;
  }

  const humpbackColor = SOUND_TYPE_COLORS.humpbackwhale;
  const finColor = SOUND_TYPE_COLORS.finwhale;
  const blueColor = SOUND_TYPE_COLORS.bluewhale;
  const shipsColor = SOUND_TYPE_COLORS.ships;
  const explosionsColor = SOUND_TYPE_COLORS.explosions;
  const bocaccioColor = SOUND_TYPE_COLORS.bocaccio;
  const dolphinColor = SOUND_TYPE_COLORS.dolphins;
  const pillColor = '#444';
  const circleStrokeColor = 'var(--border-subtle)';
  const pillFillColor = '#222';
  const pillBorderColor = '#222';
  const humpbackZeroFill = 'rgba(0,0,0,0)';
  const humpbackZeroStroke = 'var(--border-subtle)';
  const finZeroFill = 'rgba(0,0,0,0)';
  const finZeroStroke = 'var(--border-subtle)';
  const tileStyle = `--color-humpback:${humpbackColor};--color-fin:${finColor};--color-blue:${blueColor};--color-ships:${shipsColor};--color-explosions:${explosionsColor};--color-bocaccio:${bocaccioColor};--color-dolphin:${dolphinColor};--circle-stroke:${circleStrokeColor};--pill-fill:${pillFillColor};--pill-border:${pillBorderColor};--color-humpback-zero-fill:${humpbackZeroFill};--color-humpback-zero-stroke:${humpbackZeroStroke};--color-fin-zero-fill:${finZeroFill};--color-fin-zero-stroke:${finZeroStroke};`;

  const ROWS = [
    { key: 'ships', y: SHIPS_ROW_Y, color: shipsColor },
    { key: 'explosions', y: EXPLOSIONS_ROW_Y, color: explosionsColor },
    { key: 'blue', y: BLUE_ROW_Y, color: blueColor },
    { key: 'bocaccio', y: BOCCACCIO_ROW_Y, color: bocaccioColor },
    { key: 'dolphins', y: DOLPHIN_ROW_Y, color: dolphinColor }
  ] as const;

  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
  const dayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

  let isClient = false;
  let isLoading = false;
  let loadError: string | null = null;
  let dayCards: DayCard[] = [];
  let requestToken = 0;
  let dayTooltipSelection: any;

  let timelineKey: string | null = null;

  const preferredSensorLabel = (id: string | undefined) =>
    SENSOR_METADATA.find((sensor) => sensor.id === id)?.label ?? 'All sensors';

  onMount(() => {
    isClient = true;
  });

  onDestroy(() => {
    dayTooltipSelection?.remove();
    dayTooltipSelection = null;
  });

  $: monthIndex = $selectedMonth;
  $: year = $selectedYear;
  $: sensorId = $selectedSensor as SensorId | undefined;
  $: activeSensorLabel = preferredSensorLabel(sensorId);
  $: monthTitle = monthIndex === null || year === null ? 'Select a month' : monthFormatter.format(new Date(Date.UTC(year, monthIndex, 1)));
  $: monthStart = monthIndex === null || year === null ? null : new Date(Date.UTC(year, monthIndex, 1));
  $: monthEnd = monthIndex === null || year === null ? null : new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  $: timelineKey = monthStart && monthEnd ? `${monthStart.toISOString()}-${monthEnd.toISOString()}` : null;

  $: if (monthIndex === null || year === null) {
    dayCards = [];
    loadError = null;
  } else {
    loadMonthDays(monthIndex, year, sensorId);
  }

  $: activeIsoDay = normaliseIsoDay($selectedDay?.time ?? $selectedDay?.isoDay);

  function normaliseIsoDay(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return toIsoDay(value);
    }
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    return null;
  }

  async function loadMonthDays(monthIndex: number, year: number, sensor: SensorId | undefined) {
    const token = ++requestToken;
    isLoading = true;
    loadError = null;
    try {
    const entries = await getDaySummary(sensor, monthIndex, { year });
    if (token !== requestToken) return;
    dayCards = await buildDayCards(entries, year, monthIndex, sensor);
    } catch (error) {
      if (token !== requestToken) return;
      console.error('Failed to load day summary', error);
  loadError = error instanceof Error ? error.message : 'Unable to load day summary data';
  dayCards = [];
    } finally {
      if (token === requestToken) {
        isLoading = false;
      }
    }
  }

  async function buildDayCards(
    entries: DaySummaryEntry[],
    year: number,
    monthIndex: number,
    sensor: SensorId | undefined
  ): Promise<DayCard[]> {
    const map = new Map<string, DaySummaryEntry>();
    for (const entry of entries) {
      map.set(toIsoDay(entry.date), entry);
    }

    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const cardPromises: Array<Promise<DayCard>> = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(Date.UTC(year, monthIndex, day));
      const isoDay = toIsoDay(date);
      const dayEntry = map.get(isoDay);

      cardPromises.push(
        (async () => {
          const hourEntries = await getHourSummary(sensor, date);
          return buildDayCard(date, dayEntry, hourEntries);
        })()
      );
    }

    return Promise.all(cardPromises);
  }

  function buildDayCard(
    date: Date,
    entry: DaySummaryEntry | undefined,
    hourEntries: HourSummaryEntry[]
  ): DayCard {
    const hours = buildHours(hourEntries);
    const humpback = getSeriesStatus(hourEntries, entry, 'humpbackwhale');
    const fin = getSeriesStatus(hourEntries, entry, 'finwhale');
    const pills = buildPills(hours);
    const hasData = determineHasData(hours, humpback, fin, entry);

    return {
      isoDay: toIsoDay(date),
      date,
      label: dayFormatter.format(date),
      dayNumber: formatDayNumber(date),
      humpback,
      fin,
      hours,
      pills,
      hasData
    };
  }

  function buildHours(entries: HourSummaryEntry[]): HourDatum[] {
    const hourMap = new Map<number, HourSummaryEntry>();
    for (const entry of entries) {
      hourMap.set(entry.hour, entry);
    }

    return Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
      const entry = hourMap.get(hour);
      return {
        hour,
        ships: getValueStatus(entry?.values.ships),
        explosions: getValueStatus(entry?.values.explosions),
        blue: getValueStatus(entry?.values.bluewhale),
        bocaccio: getValueStatus(entry?.values.bocaccio),
        dolphins: getValueStatus(entry?.values.dolphins)
      } satisfies HourDatum;
    });
  }

  function getValueStatus(value: number | null | undefined): ValueStatus {
    if (value === null || value === undefined) return 'missing';
    if (value > 0) return 'detect';
    return 'zero';
  }



  function getSeriesStatus(
    entries: HourSummaryEntry[],
    dayEntry: DaySummaryEntry | undefined,
    key: 'humpbackwhale' | 'finwhale'
  ): ValueStatus {
    const values = entries
      .map((entry) => entry.values[key])
      .filter((value): value is number | null => value !== undefined && value !== null);
    if (values.length > 0) {
      return values.some((value) => (value ?? 0) > 0) ? 'detect' : 'zero';
    }
    const dayValue = dayEntry?.values[key];
    return getValueStatus(dayValue);
  }

  function buildPills(hours: HourDatum[]): PillDatum[] {
    const pills = hours
      .filter(
        (hour) =>
          (hour.ships === 'detect' || hour.explosions === 'detect') &&
          (hour.blue === 'detect' || hour.bocaccio === 'detect' || hour.dolphins === 'detect')
      )
      .map((hour) => {
        const activeRows = ROWS.filter((row) => hour[row.key as keyof HourDatum] === 'detect').map((row) => ({
          key: row.key,
          y: row.y,
          color: row.color
        }));
        return { hour: hour.hour, activeRows };
      });
      return pills;

  }

  function determineHasData(
    hours: HourDatum[],
    humpback: ValueStatus,
    fin: ValueStatus,
    entry: DaySummaryEntry | undefined
  ): boolean {
    const hasHourly = hours.some(
      (hour) =>
        hour.ships !== 'missing' ||
        hour.explosions !== 'missing' ||
        hour.blue !== 'missing' ||
        hour.bocaccio !== 'missing' ||
        hour.dolphins !== 'missing'
    );
    if (hasHourly) return true;
    if (humpback !== 'missing' || fin !== 'missing') return true;
    return entry ? hasAnyValue(entry) : false;
  }

  function hasAnyValue(entry: DaySummaryEntry): boolean {
    return Object.values(entry.values).some((value) => value !== null && value !== undefined);
  }

  function hourToX(hour: number) {
    return TIMELINE_MARGIN_LEFT + hour * (COLUMN_WIDTH + COLUMN_GAP) + HOUR_CENTER_OFFSET;
  }

  function lightenColor(colorValue: string, amount: number): string {
    const parsed = d3.color(colorValue);
    if (!parsed) return colorValue;
    const hsl = d3.hsl(parsed);
    hsl.l = Math.min(1, Math.max(0, hsl.l + amount));
    return hsl.formatHex();
  }

  function formatDayNumber(date: Date): string {
    return String(date.getUTCDate());
  }

  function ensureDayTooltip() {
    if (dayTooltipSelection) {
      return dayTooltipSelection;
    }
    dayTooltipSelection = select('body')
      .append('div')
      .attr('class', 'day-card-tooltip hidden')
      .style('position', 'fixed')
      .style('pointer-events', 'none')
      .style('left', '0px')
      .style('top', '0px');
    return dayTooltipSelection;
  }

  function moveDayTooltip(event: MouseEvent) {
    const tooltip = ensureDayTooltip();
    const offset = 14;
    const tooltipWidth = 192;
    const viewportWidth = window.innerWidth;
    
    const wouldOverflowRight = event.clientX + offset + tooltipWidth > viewportWidth;
    
    if (wouldOverflowRight) {
      tooltip
        .style('left', `${event.clientX - offset}px`)
        .style('top', `${event.clientY + offset}px`)
        .style('transform', 'translateX(-100%)');
    } else {
      tooltip
        .style('left', `${event.clientX + offset}px`)
        .style('top', `${event.clientY + offset}px`)
        .style('transform', null);
    }
  }

  function showDayTooltip(event: MouseEvent, card: DayCard) {
    const tooltip = ensureDayTooltip();
    const dateLabel = formatDayTooltip(card.date);
    tooltip
      .classed('hidden', false)
      .html(`<span class="tooltip-label">${dateLabel}</span>`);
    moveDayTooltip(event);
  }

  function hideDayTooltip() {
    dayTooltipSelection?.classed('hidden', true);
  }

  function formatDayTooltip(date: Date): string {
    const day = date.getUTCDate();
    const suffix = getDaySuffix(day);
    const month = date.toLocaleDateString(undefined, { month: 'long', timeZone: 'UTC' });
    return `${day}${suffix} ${month}`;
  }

  function getDaySuffix(day: number): string {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  function openDay(card: DayCard) {
    if (!year || !card.hasData) return;
    goToDay({
      time: card.date,
      isoDay: card.isoDay,
      label: card.label,
      year,
      dayCard: card
    });
  }

  function toIsoDay(date: Date): string {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function generatePillPath(x: number, activeRows: Array<{ y: number }>, compressionOffset: number): string {
    if (activeRows.length === 0) return '';
    
    const sortedRows = [...activeRows].sort((a, b) => a.y - b.y);
    const topY = sortedRows[0].y - circleRadius - compressionOffset;
    const bottomY = sortedRows[sortedRows.length - 1].y + circleRadius - compressionOffset;
    
    const width = 15; // Width of the pill shape
    const halfWidth = width / 2;
    const bulgeFactor = 5; // How much the circles bulge out
    const pinchFactor = 0.1; // How much to pinch between circles
    
    let path = '';
    
    // Start at top-left
    path += `M ${x - halfWidth} ${topY} `;
    
    // Right side going down with bulges at each circle
    for (let i = 0; i < sortedRows.length; i++) {
      const circleY = sortedRows[i].y - compressionOffset;
      const isLast = i === sortedRows.length - 1;
      
      // Bulge out at circle center
      const bulgeX = x + halfWidth + bulgeFactor;
      
      if (i === 0) {
        // Curve from top to first bulge
        path += `Q ${x + halfWidth} ${topY + 5}, ${bulgeX} ${circleY} `;
      } else {
        // Curve from previous pinch to this bulge
        const prevCircleY = sortedRows[i - 1].y - compressionOffset;
        const pinchY = (prevCircleY + circleY) / 2;
        const pinchX = x + halfWidth * pinchFactor;
        path += `Q ${pinchX} ${pinchY}, ${bulgeX} ${circleY} `;
      }
      
      if (isLast) {
        // Curve from last bulge to bottom
        path += `Q ${x + halfWidth} ${bottomY - 5}, ${x + halfWidth} ${bottomY} `;
      }
    }
    
    // Bottom edge
    path += `L ${x - halfWidth} ${bottomY} `;
    
    // Left side going up with bulges at each circle (in reverse)
    for (let i = sortedRows.length - 1; i >= 0; i--) {
      const circleY = sortedRows[i].y - compressionOffset;
      const isFirst = i === 0;
      
      // Bulge out at circle center
      const bulgeX = x - halfWidth - bulgeFactor;
      
      if (i === sortedRows.length - 1) {
        // Curve from bottom to last bulge
        path += `Q ${x - halfWidth} ${bottomY - 5}, ${bulgeX} ${circleY} `;
      } else {
        // Curve from next pinch to this bulge
        const nextCircleY = sortedRows[i + 1].y - compressionOffset;
        const pinchY = (nextCircleY + circleY) / 2;
        const pinchX = x - halfWidth * pinchFactor;
        path += `Q ${pinchX} ${pinchY}, ${bulgeX} ${circleY} `;
      }
      
      if (isFirst) {
        // Curve from first bulge back to top
        path += `Q ${x - halfWidth} ${topY + 5}, ${x - halfWidth} ${topY} `;
      }
    }
    
    path += 'Z';
    return path;
  }

  function generateGradientId(cardIsoDay: string, hour: number): string {
    return `pill-gradient-${cardIsoDay}-${hour}`;
  }
</script>

<section class="month-view">
  <header class="month-header">
    <div>
      <!-- <h2>{monthTitle}</h2> -->
      <!-- <p class="sensor-label">{activeSensorLabel}</p> -->
    </div>
  </header>

  {#if isLoading}
    <p class="status">Loading daily activity…</p>
  {:else if loadError}
    <p class="status error">{loadError}</p>
  {:else if !dayCards.length}
    <p class="status">No days available in this month.</p>
  {:else}
    <!-- {#if isClient && timelineKey && monthStart && monthEnd}
      {#key timelineKey}
        <div class="timeline-wrapper" aria-hidden="true">
          <DayTimeline startDate={monthStart} endDate={monthEnd} showDates />
        </div>
      {/key}
    {/if} -->

    <div class="day-grid">
      {#each dayCards as card}
        <button
          type="button"
          class={`day-button ${activeIsoDay === card.isoDay ? 'active' : ''}`}
          on:click={() => openDay(card)}
          on:mouseenter={(event) => showDayTooltip(event, card)}
          on:mousemove={moveDayTooltip}
          on:mouseleave={hideDayTooltip}
          disabled={!card.hasData}
          aria-label={`View ${card.label} details`}
        >
          <div
            class={`day ${card.hasData ? '' : 'empty-day'} ${activeIsoDay === card.isoDay ? 'active' : ''}`}
            style={tileStyle}
          >
            <svg
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT_COMPRESSED}`}
              role="img"
              aria-label={`Timeline for ${card.label}`}
            >
              <!-- Time labels -->
              <text
                x={hourToX(0)}
                y={0}
                text-anchor="middle"
                class="time-label"
              >0</text>
              <text
                x={hourToX(12)}
                y={0}
                text-anchor="middle"
                class="time-label"
              >12</text>
              <text
                x={hourToX(23)}
                y={0}
                text-anchor="middle"
                class="time-label"
              >24</text>

              {#if card.humpback !== 'missing'}
                <rect
                  x={TIMELINE_MARGIN_LEFT}
                  y={HUMPBACK_BAR_Y - COMPRESSION_OFFSET}
                  width={BAR_WIDTH}
                  height={BAR_HEIGHT}
                  rx={BAR_HEIGHT / 2}
                  class={`bar humpback ${card.humpback}`}
                />
              {/if}
              {#if card.fin !== 'missing'}
                <rect
                  x={TIMELINE_MARGIN_LEFT}
                  y={FIN_BAR_Y - COMPRESSION_OFFSET}
                  width={BAR_WIDTH}
                  height={BAR_HEIGHT}
                  rx={BAR_HEIGHT / 2}
                  class={`bar fin ${card.fin}`}
                />
              {/if}

              {#each card.hours as hour}
                <circle
                  cx={hourToX(hour.hour)}
                  cy={SHIPS_ROW_Y - COMPRESSION_OFFSET}
                  r={circleRadius}
                  class={`circle ships ${hour.ships}`}
                />
                <circle
                  cx={hourToX(hour.hour)}
                  cy={EXPLOSIONS_ROW_Y - COMPRESSION_OFFSET}
                  r={circleRadius}
                  class={`circle explosions ${hour.explosions}`}
                />
                <circle
                  cx={hourToX(hour.hour)}
                  cy={BLUE_ROW_Y - COMPRESSION_OFFSET}
                  r={circleRadius}
                  class={`circle blue ${hour.blue}`}
                />
                <circle
                  cx={hourToX(hour.hour)}
                  cy={BOCCACCIO_ROW_Y - COMPRESSION_OFFSET}
                  r={circleRadius}
                  class={`circle bocaccio ${hour.bocaccio}`}
                />
                <circle
                  cx={hourToX(hour.hour)}
                  cy={DOLPHIN_ROW_Y - COMPRESSION_OFFSET}
                  r={circleRadius}
                  class={`circle dolphin ${hour.dolphins}`}
                />
              {/each}

              <defs>
                {#each card.pills as pill}
                  {@const gradientId = generateGradientId(card.isoDay, pill.hour)}
                  {@const sortedRows = [...pill.activeRows].sort((a, b) => a.y - b.y)}
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    {#each sortedRows as row, i}
                      {@const offset = i / Math.max(1, sortedRows.length - 1)}
                      <stop offset={i === 0 ? '0%' : `${offset * 100}%`} stop-color={row.color} />
                    {/each}
                  </linearGradient>
                {/each}
              </defs>

              {#each card.pills as pill}
                {@const pillPath = generatePillPath(hourToX(pill.hour), pill.activeRows, COMPRESSION_OFFSET)}
                {@const gradientId = generateGradientId(card.isoDay, pill.hour)}
                <path
                  d={pillPath}
                  fill={`url(#${gradientId})`}
                  class="pill"
                />
              {/each}
            </svg>
            <!-- <span class="day-number">{card.dayNumber}</span> -->
          </div>
        </button>
      {/each}
    </div>
  {/if}
</section>

<style>
  .month-view {
    display: flex;
    flex-direction: column;
  }

  .month-header {
    display: flex;
    flex-direction: column;
    /* flex-wrap: wrap; */
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem 1.5rem;
  }

  .sensor-label {
    margin: 0.2rem 0 0;
    color: #64748b;
  }

  .status {
    margin: 0;
    font-size: 0.95rem;
    color: #475569;
  }

  .status.error {
    color: #dc2626;
  }

  .timeline-wrapper {
    border-radius: 1rem;
    border: 1px solid rgba(148, 163, 184, 0.35);
    padding: 1rem;
    background: rgba(15, 23, 42, 0.02);
    overflow-x: auto;
  }

  .day-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .day-button {
    appearance: none;
    border: none;
    padding: 0;
    background: none;
    cursor: pointer;
    width: 100%;
    transition: transform 0.2s ease;
  }

  .day-button:not(:disabled):hover {
    transform: scale(1.05);
  }

  .day-button:disabled {
    cursor: not-allowed;
  }

  .day-button:disabled .day {
    opacity: 0.45;
  }

  .day-button:focus-visible .day {
    outline: 2px solid #0ea5e9;
    outline-offset: 4px;
    border-radius: 1rem;
  }

  .day-button.active .day svg {
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.25);
    border-radius: 1rem;
  }

  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
  }

  .day.empty-day svg {
    opacity: 0.4;
  }

  .day-number {
    font-size: 0.82rem;
    font-weight: 500;
  }

  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  .bar.detect.humpback {
    fill: var(--color-humpback);
  }

  .bar.zero.humpback {
    fill: var(--color-humpback-zero-fill);
    stroke: var(--color-humpback-zero-stroke);
    stroke-width: 1;
  }

  .bar.detect.fin {
    fill: var(--color-fin);
  }

  .bar.zero.fin {
    fill: var(--color-fin-zero-fill);
    stroke: var(--color-fin-zero-stroke);
    stroke-width: 1;
  }

  .circle {
    fill: none;
    stroke: var(--circle-stroke);
    stroke-width: 1.6;
  }

  .circle.zero {
    fill: none;
  }

  .circle.ships.detect {
    fill: var(--color-ships);
    stroke: var(--color-ships);
  }

  .circle.explosions.detect {
    fill: var(--color-explosions);
    stroke: var(--color-explosions);
  }

  .circle.blue.detect {
    fill: var(--color-blue);
    stroke: var(--color-blue);
  }

  .circle.bocaccio.detect {
    fill: var(--color-bocaccio);
    stroke: var(--color-bocaccio);
  }

  .circle.dolphin.detect {
    fill: var(--color-dolphin);
    stroke: var(--color-dolphin);
  }

  .circle.missing {
    stroke: none;
    fill: none;
  }

  .pill {
    opacity: 0.85;
  }

  .time-label {
    font-size: 2rem;
    fill: var(--text-secondary, #94a3b8);
    font-family: var(--font-mono, monospace);
    opacity: 0.9;
  }

  :global(.day-card-tooltip) {
    z-index: 10;
    background: var(--surface-overlay);
    border: 1px solid var(--border-subtle);
    font-family: var(--font-mono, monospace);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.75rem;
    /* box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); */
    transition: opacity 0.15s ease;
    opacity: 1;
    max-width: 12rem;
    text-transform: none;
  }

  :global(.day-card-tooltip.hidden) {
    opacity: 0;
  }

  :global(.day-card-tooltip .tooltip-label) {
    font-weight: 600;
    text-transform: capitalize;
  }

  @media (max-width: 1600px) {
    .day-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  @media (max-width: 1200px) {
    .day-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .timeline-wrapper {
      padding: 0.75rem;
    }

    .day-grid {
      grid-template-columns: repeat(1, minmax(0, 1fr));
    }
  }
</style>
