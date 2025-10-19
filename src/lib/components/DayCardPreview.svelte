<script lang="ts">
  import { SOUND_TYPE_COLORS } from '$lib/data';
  import type {
    DayCardPreviewData,
    HourDatum,
    PillDatum
  } from '$lib/types/day-card';

  const HOURS_PER_DAY = 24;
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

  export let card: DayCardPreviewData | null = null;

  function hourToX(hour: number) {
    return TIMELINE_MARGIN_LEFT + hour * (COLUMN_WIDTH + COLUMN_GAP) + HOUR_CENTER_OFFSET;
  }

  function generatePillPath(
    x: number,
    activeRows: Array<{ y: number }>,
    compressionOffset: number
  ): string {
    if (activeRows.length === 0) return '';

    const sortedRows = [...activeRows].sort((a, b) => a.y - b.y);
    const topY = sortedRows[0].y - circleRadius - compressionOffset;
    const bottomY = sortedRows[sortedRows.length - 1].y + circleRadius - compressionOffset;

    const width = 15;
    const halfWidth = width / 2;
    const bulgeFactor = 5;
    const pinchFactor = 0.1;

    let path = '';

    path += `M ${x - halfWidth} ${topY} `;

    for (let i = 0; i < sortedRows.length; i += 1) {
      const circleY = sortedRows[i].y - compressionOffset;
      const isLast = i === sortedRows.length - 1;
      const bulgeX = x + halfWidth + bulgeFactor;

      if (i === 0) {
        path += `Q ${x + halfWidth} ${topY + 5}, ${bulgeX} ${circleY} `;
      } else {
        const prevCircleY = sortedRows[i - 1].y - compressionOffset;
        const pinchY = (prevCircleY + circleY) / 2;
        const pinchX = x + halfWidth * pinchFactor;
        path += `Q ${pinchX} ${pinchY}, ${bulgeX} ${circleY} `;
      }

      if (isLast) {
        path += `Q ${x + halfWidth} ${bottomY - 5}, ${x + halfWidth} ${bottomY} `;
      }
    }

    path += `L ${x - halfWidth} ${bottomY} `;

    for (let i = sortedRows.length - 1; i >= 0; i -= 1) {
      const circleY = sortedRows[i].y - compressionOffset;
      const isFirst = i === 0;
      const bulgeX = x - halfWidth - bulgeFactor;

      if (i === sortedRows.length - 1) {
        path += `Q ${x - halfWidth} ${bottomY - 5}, ${bulgeX} ${circleY} `;
      } else {
        const nextCircleY = sortedRows[i + 1].y - compressionOffset;
        const pinchY = (nextCircleY + circleY) / 2;
        const pinchX = x - halfWidth * pinchFactor;
        path += `Q ${pinchX} ${pinchY}, ${bulgeX} ${circleY} `;
      }

      if (isFirst) {
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

{#if card}
  <div class="day-card" style={tileStyle}>
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT_COMPRESSED}`}
      role="img"
      aria-label={`Timeline for ${card.label}`}
    >
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
          height={BAR_HEIGHT}\n          rx={BAR_HEIGHT / 2}
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
        <path d={pillPath} fill={`url(#${gradientId})`} class="pill" />
      {/each}
    </svg>
  </div>
{/if}

<style>
  .day-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  svg {
    width: 100%;
    height: auto;
    display: block;
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
</style>
