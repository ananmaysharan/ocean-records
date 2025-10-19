<script lang="ts">
  import yearLegendUrl from '/assets/legend/year_legend.svg?url';
  import monthLegendUrl from '/assets/legend/month_legend.svg?url';

  interface LegendConfig {
    src: string;
    alt: string;
    aspect: string;
  }

  const LEGEND_CONFIG: Record<'year' | 'month', LegendConfig> = {
    year: {
      src: yearLegendUrl,
      alt: 'Legend explaining year view detections by sound type',
      aspect: '121 / 61'
    },
    month: {
      src: monthLegendUrl,
      alt: 'Legend explaining month view timeline of detections',
      aspect: '115 / 61'
    }
  };

  export let variant: 'year' | 'month' | null = null;
  export let alt: string | undefined = undefined;
  export let className = '';
  export let style: string | undefined = undefined;

  $: legend = variant ? LEGEND_CONFIG[variant] : null;
  $: computedAlt = legend ? alt ?? legend.alt : alt;
  $: styleString = legend
    ? `${style ? style.trim().replace(/;?$/, '; ') : ''}--legend-url: url('${legend.src}'); aspect-ratio: ${legend.aspect};`
    : style ?? '';
</script>

{#if legend}
  <div
    class={`legend-graphic ${className}`.trim()}
    role="img"
    aria-label={computedAlt}
    style={styleString}
  ></div>
{/if}

<style>
  .legend-graphic {
    width: clamp(160px, 24vw, 180px);
    background-color: var(--text-primary);
    mask-image: var(--legend-url);
    mask-repeat: no-repeat;
    mask-size: contain;
    mask-position: center;
    -webkit-mask-image: var(--legend-url);
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    -webkit-mask-position: center;
  }
</style>
