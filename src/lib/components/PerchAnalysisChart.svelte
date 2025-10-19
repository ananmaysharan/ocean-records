<script lang="ts">
  import { SOUND_TYPE_COLORS, type SoundType } from '$lib/data';

  // Data from the user with proper formatting
  const data: Array<{ label: string; value: number; soundType: SoundType }> = [
    { label: 'Humpback', value: 110.787796, soundType: 'humpbackwhale' },
    { label: 'Ship', value: 80.033500, soundType: 'ships' },
    { label: 'Explosion', value: 42.768167, soundType: 'explosions' },
    { label: 'Boccacio', value: 23.428796, soundType: 'bocaccio' },
    { label: 'Blue Whale', value: 2.500500, soundType: 'bluewhale' },
    { label: 'Fin Whale', value: 0.833500, soundType: 'finwhale' },
    { label: 'Dolphin Clicks', value: 0.500100, soundType: 'dolphins' },
    { label: 'Dolphin Song', value: 0.333400, soundType: 'dolphins' }
  ];

  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => d.value));
  
  // Chart dimensions
  const chartHeight = 400;
  const labelWidth = 180;
  const valueWidth = 60;
  const barMaxWidth = 500;
  const rowHeight = 50;
  const titleHeight = 80;
  const totalHeight = titleHeight + (data.length * rowHeight);
</script>

<div class="perch-analysis">
  <div class="chart-title">
    <h2>Perch Analysis</h2>
  </div>
  
  <div class="chart-container">
    <div class="chart-header">
      <div class="header-label">Sound</div>
      <div class="header-value ml-6">Minutes</div>
    </div>
    
    <div class="chart-rows">
      {#each data as item, i}
        <div class="chart-row">
          <div class="row-label text-sm">{item.label}</div>
          <div class="row-value tex-sm">{Math.round(item.value)}</div>
          <div class="row-bar-container">
            <div 
              class="row-bar" 
              style="width: {(item.value / maxValue) * 100}%; background-color: {SOUND_TYPE_COLORS[item.soundType]};"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .perch-analysis {
    width: 100%;
    color: var(--text-primary);
    font-family: var(--font-mono, monospace);
  }

  .chart-title {
    margin-bottom: 1.5rem;
  }

  .chart-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .chart-header {
    display: grid;
    grid-template-columns: 140px 60px 1fr;
    column-gap: 0;
    font-size: 0.875rem;
    font-weight: 600;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .header-label {
    text-align: left;
  }

  .header-value {
    text-align: left;
    padding-right: 0.5rem;
  }

  .chart-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chart-row {
    display: grid;
    grid-template-columns: 140px 60px 1fr;
    column-gap: 0;
    align-items: center;
  }

  .row-label {
    text-align: left;
  }

  .row-value {
    text-align: right;
    font-weight: 500;
    padding-right: 0.5rem;
  }

  .row-bar-container {
    position: relative;
    height: 24px;
    width: 100%;
  }

  .row-bar {
    height: 100%;
    border-radius: 2px;
    transition: width 400ms ease;
  }
</style>
