<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import LegendItem from '../LegendItem.svelte';
  import { SENSOR_METADATA } from '$lib/data';
  import { selectedDay, selectedSensor } from '$lib/state/navigation';
  import type {} from 'p5/lib/addons/p5.sound';

  const soundTypes = [
    'ships',
    'explosions',
    'bluewhale',
    'finwhale',
    'humpbackwhale',
    'bocaccio',
    'dolphins'
  ] as const;

  const typeStatuses: Record<(typeof soundTypes)[number], string> = {
    ships: '',
    explosions: '',
    bluewhale: 'Endangered',
    finwhale: 'Endangered',
    humpbackwhale: 'Threatened',
    bocaccio: 'Vulnerable',
    dolphins: 'Vulnerable'
  };

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });

  const audioAssetUrl = new URL('../assets/enhanced.wav', import.meta.url).href;
  const eventsCsvUrl = new URL('../assets/offsets.csv', import.meta.url).href;

  let canvasParent: HTMLDivElement | null = null;
  let sketchInstance: any = null;
  let disposeSketch: (() => void) | null = null;
  let isMounted = false;

  function resolveSelectedDate() {
    const selection = $selectedDay;
    if (!selection) return null;
    const { time } = selection;
    if (time instanceof Date) {
      return time;
    }
    if (typeof time === 'string') {
      const parsed = new Date(time);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    const isoDay = typeof selection.isoDay === 'string' ? selection.isoDay : undefined;
    if (isoDay) {
      const parsed = new Date(isoDay);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return null;
  }

  function readColorVariable(varName: string, fallback: string): string {
    const root = getComputedStyle(document.documentElement);
    const value = root.getPropertyValue(varName);
    return value ? value.trim() || fallback : fallback;
  }

  $: activeDate = resolveSelectedDate();
  $: formattedDate = activeDate ? dateFormatter.format(activeDate) : null;
  $: sensorLabel = SENSOR_METADATA.find((sensor) => sensor.id === $selectedSensor)?.label ?? 'All sensors';
  $: shouldRenderSketch = Boolean(formattedDate);

  async function startSketch() {
    if (!isMounted || !shouldRenderSketch || !canvasParent || sketchInstance) return;
    const [{ default: P5Ctor }] = await Promise.all([import('p5')]);
    if (typeof window !== 'undefined') {
      const win = window as typeof window & { p5?: unknown };
      if (!win.p5) {
        win.p5 = P5Ctor;
      }
    }
    await import('p5/lib/addons/p5.sound');
    if (!canvasParent || sketchInstance) return;
  const { sketch, cleanup } = createSketch(P5Ctor, canvasParent);
    sketchInstance = sketch;
    disposeSketch = cleanup;
  }

  function stopSketch() {
    disposeSketch?.();
    disposeSketch = null;
    if (sketchInstance) {
      sketchInstance.remove();
      sketchInstance = null;
    }
  }

  onMount(() => {
    isMounted = true;
    if (shouldRenderSketch) {
      startSketch();
    }
    return () => {
      isMounted = false;
      stopSketch();
    };
  });

  onDestroy(() => {
    isMounted = false;
    stopSketch();
  });

  $: if (isMounted) {
    if (shouldRenderSketch) {
      startSketch();
    } else {
      stopSketch();
    }
  }

  function createSketch(P5Ctor: typeof import('p5'), container: HTMLDivElement) {
    let requestRefresh: (() => void) | null = null;
    let stopAudio: (() => void) | null = null;

    const readThemeColors = () => ({
      background: readColorVariable('--surface-2', '#0A132F'),
      quiet: readColorVariable('--color-quiet', 'rgba(10, 19, 47, 0)'),
      ambient: readColorVariable('--color-ambient', 'rgba(10, 19, 47, 0)'),
      text: readColorVariable('--text-secondary', '#CBD5E1'),
      frame: readColorVariable('--border-subtle', 'rgba(148, 163, 184, 0.4)')
    });

    const buildPalette = (colors: ReturnType<typeof readThemeColors>) => ({
      background: colors.background || '#0A132F',
      quiet: colors.quiet || 'rgba(10, 19, 47, 0)',
      ambient: colors.ambient || 'rgba(10, 19, 47, 0)',
      text: colors.text || '#CBD5E1',
      frame: colors.frame || 'rgba(148, 163, 184, 0.4)'
    });

    const sketch = new P5Ctor((p: any) => {
      const BANDS = 256;
      const FFT_SMOOTHING = 0.2;
      const FFT_SIZE = 1024;
      const FREQ_MAX_HZ = 5000;
      const LEFT_MARGIN = 100;
      const RIGHT_MARGIN = 100;
      const TOP_MARGIN = 120;
      const BOTTOM_MARGIN = 100;
      const DOTS_PER_BAND = 1;
      const QUIET_RADIUS = 0;
      const MAX_RADIUS = 6;
      const ENERGY_GAIN = 2.0;
      const CHANGE_GAIN = 2.5;
      const MAX_STROKE = 2.0;
      const SECONDS_ACROSS = 849;
      const BASELINE_LERP = 0.0005;
      const NOISE_MARGIN = 70;
      const TRIGGER = 40;
      const GAMMA = 0.8;
      const CANVAS_W = 1600;
      const CANVAS_H = 900;
      const COLOR_RADIUS_BOOST = 1;
      const COLOR_STROKE_BOOST = 1;

      const SHOW_UTC_TIMER = true;
      const UTC_TIMER_X = CANVAS_W - 140;
      const UTC_TIMER_Y = 15;
      const UTC_TIMER_TEXT_SIZE = 14;
      const UTC_TIMER_TEXT_ALPHA = 200;
      const UTC_TIMER_BG_ALPHA = 110;
      const LOCAL_TIMEZONE = 'America/Los_Angeles';

      const LABEL_COLORS: Record<string, string> = {
        seal_bomb: '#FE7C1F',
        bluewhale: '#73CBE9',
        finwhale: '#E8BB48',
        ship: '#E44000',
        Dolphin_call: '#81C995',
        dolphin_song: '#81C995',
        humpback: '#E656E1',
        boccacio: '#9F6FF8'
      };

      const EVENT_WINDOWS: Record<string, number> = {
        seal_bomb: 0.3,
        bluewhale: 1.0,
        finwhale: 1.0,
        ship: 1.0,
        Dolphin_call: 1.0,
        dolphin_song: 1.0,
        humpback: 1.0,
        boccacio: 1.0
      };

      const COLOR_LABEL_ORDER = [
        'humpback',
        'Dolphin_call',
        'boccacio',
        'dolphin_song',
        'bluewhale',
        'finwhale',
        'seal_bomb',
        'ship'
      ];

      const LABEL_WEIGHTS: Record<string, number> = {
        humpback: 1.0,
        bluewhale: 1.0,
        finwhale: 1.0,
        boccacio: 1.0,
        dolphin_song: 1.0,
        Dolphin_call: 1.0,
        seal_bomb: 1.2,
        ship: 1.0,
        default: 1.0
      };

      const LABEL_FREQ_MIN: Record<string, number | undefined> = {
        Dolphin_call: 2000
      };

      const LABEL_FREQ_MAX: Record<string, number | undefined> = {
        finwhale: 80,
        bluewhale: 80,
        boccacio: 1200
      };

      const MARKER_Y_DEFAULT = CANVAS_H - BOTTOM_MARGIN + 22;
      const MARKER_RADIUS_DEF = 4;
      const MARKER_ALPHA = 230;
      const MARKER_TOP_OFFSET = 10;
      const LABEL_MARKER_Y: Record<string, number> = {
        dolphin_song: TOP_MARGIN - (20 + MARKER_TOP_OFFSET),
        Dolphin_call: TOP_MARGIN - (20 + MARKER_TOP_OFFSET),
        boccacio: TOP_MARGIN - (30 + MARKER_TOP_OFFSET),
        humpback: TOP_MARGIN - (40 + MARKER_TOP_OFFSET),
        finwhale: TOP_MARGIN - (50 + MARKER_TOP_OFFSET),
        bluewhale: TOP_MARGIN - (60 + MARKER_TOP_OFFSET),
        seal_bomb: TOP_MARGIN - (70 + MARKER_TOP_OFFSET),
        ship: TOP_MARGIN - (80 + MARKER_TOP_OFFSET)
      };

      const LABEL_MARKER_R: Record<string, number> = {
        humpback: 4,
        dolphin_song: 4,
        boccacio: 4,
        ship: 4,
        seal_bomb: 4
      };

      const SHOW_LABEL_TEXT = false;
      const LABEL_TEXT_Y_DEFAULT = TOP_MARGIN - 16;
      const LABEL_TEXT_SIZE = 12;
      const LABEL_TEXT_Y: Record<string, number> = {
        humpback: TOP_MARGIN - 16,
        dolphin_song: TOP_MARGIN - 30,
        boccacio: TOP_MARGIN - 44,
        ship: TOP_MARGIN - 58,
        seal_bomb: TOP_MARGIN - 72
      };

      const SHOW_NOW_PLAYING = true;
      const NOW_X = 100;
      const NOW_Y = CANVAS_H - 60;
      const NOW_TEXT_SIZE = 12;
      const NOW_TEXT_ALPHA = 180;
      const NP_FADE_MS = 300;

      type EventEntry = {
        start: number;
        end: number;
        label: string;
        logits: number | null;
        utcMs: number | null;
      };

      let snd: any;
      let fft: any;
      let eventsTable: any;
      let events: EventEntry[] = [];
      let x = 0;
      let pxPerMs = 0;
      let baseline: number[] = [];
      let prevEnergy: number[] = [];
      let needClickHint = false;
      let bandFreqs: number[] = [];
      let effFmax = FREQ_MAX_HZ;
      let VIS_BANDS = BANDS;
      let baselineReady = false;
      let calibrateUntil = 0;
      let themeColors = readThemeColors();
      let palette = buildPalette(themeColors);
      let needsRefresh = true;
      let npLabel: string | null = null;
      let npLogits: number | null = null;
      let npAlpha = 1;
      let npChangedAt = 0;

      const matchesTheme = (next: ReturnType<typeof readThemeColors>) =>
        next.background === themeColors.background &&
        next.quiet === themeColors.quiet &&
        next.ambient === themeColors.ambient &&
        next.text === themeColors.text &&
        next.frame === themeColors.frame;

      const updateThemeIfNeeded = () => {
        const next = readThemeColors();
        if (!matchesTheme(next)) {
          themeColors = next;
          palette = buildPalette(themeColors);
          needsRefresh = true;
        }
      };

      requestRefresh = () => {
        themeColors = readThemeColors();
        palette = buildPalette(themeColors);
        needsRefresh = true;
      };

      const baselineStorageKey = () => `oceanfft_baseline_v1_${VIS_BANDS}_${Math.round(effFmax)}`;

      const resampleArray = (arr: number[] | undefined, newLen: number) => {
        if (!arr || !arr.length) return new Array(newLen).fill(10);
        if (arr.length === newLen) return arr.slice();
        const out = new Array(newLen);
        for (let i = 0; i < newLen; i += 1) {
          const t = newLen === 1 ? 0 : i / (newLen - 1);
          const src = t * (arr.length - 1);
          const i0 = Math.floor(src);
          const i1 = Math.min(arr.length - 1, i0 + 1);
          const f = src - i0;
          out[i] = arr[i0] * (1 - f) + arr[i1] * f;
        }
        return out;
      };

      const baselineInit = () => {
        if (typeof window === 'undefined') {
          calibrateUntil = p.millis() + 10_000;
          baselineReady = false;
          return;
        }
        try {
          const raw = window.localStorage.getItem(baselineStorageKey());
          if (raw) {
            const obj = JSON.parse(raw);
            baseline = resampleArray(obj.baseline, VIS_BANDS);
            baselineReady = true;
            return;
          }
        } catch (error) {
          console.warn('Failed to load baseline', error);
        }
        calibrateUntil = p.millis() + 10_000;
        baselineReady = false;
      };

      const baselineTick = () => {
        if (baselineReady || typeof window === 'undefined') return;
        if (p.millis() < calibrateUntil) return;
        baselineReady = true;
        try {
          window.localStorage.setItem(
            baselineStorageKey(),
            JSON.stringify({ baseline, visBands: VIS_BANDS, effFmax })
          );
        } catch (error) {
          console.warn('Failed to save baseline', error);
        }
      };

      const drawBaselineStatus = () => {
        p.noStroke();
        const textColor = p.color(palette.text);
        textColor.setAlpha(150);
        p.fill(textColor);
        p.textSize(12);
        p.textAlign(p.LEFT, p.BOTTOM);
        const remaining = Math.max(0, (calibrateUntil - p.millis()) / 1000);
        const msg = baselineReady
          ? ''
          : `Calibrating… ${remaining.toFixed(1)}s`;
        p.text(msg, 16, p.height - 12);
      };

      const formatHz = (f: number) =>
        f >= 1000 ? `${(f / 1000).toFixed(f < 10000 ? 1 : 0)} kHz` : `${Math.round(f)} Hz`;

      const parseUTCtoMs = (value: string | null) => {
        if (!value) return null;
        let t = value.trim().replace(' ', 'T');
        t = t.replace(/(\.\d{3})\d+/, '$1');
        const ms = Date.parse(t);
        return Number.isFinite(ms) ? ms : null;
      };

      const fmtHourTZ00 = (ms: number | null, tz: string) => {
        if (ms == null) return '';
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: '2-digit',
          hour12: false
        }).formatToParts(new Date(ms));
        const hh = parts.find((pPart) => pPart.type === 'hour')?.value ?? '00';
        return `${hh}:00`;
      };

      const drawUtcHourTimer = (event: EventEntry | null) => {
        if (!SHOW_UTC_TIMER || !event || !Number.isFinite(event.utcMs ?? NaN)) return;

        if (UTC_TIMER_BG_ALPHA > 0) {
          p.noStroke();
          const bgCol = p.color(palette.background);
          bgCol.setAlpha(UTC_TIMER_BG_ALPHA);
          const pad = 6;
          const w = 72;
          const h = UTC_TIMER_TEXT_SIZE + pad * 2;
          p.fill(bgCol);
          p.rect(UTC_TIMER_X - pad, UTC_TIMER_Y - UTC_TIMER_TEXT_SIZE - pad + 2, w, h, 6);
        }

        p.noStroke();
        const textCol = p.color(palette.text);
        textCol.setAlpha(UTC_TIMER_TEXT_ALPHA);
        p.fill(textCol);
        p.textSize(UTC_TIMER_TEXT_SIZE);
        p.textAlign(p.LEFT, p.BOTTOM);
        p.text(fmtHourTZ00(event.utcMs, LOCAL_TIMEZONE), UTC_TIMER_X, UTC_TIMER_Y);
      };

      const getActiveLabelsAtTime = (tSec: number) => {
        if (!events.length) return [] as string[];
        const active = new Set<string>();
        for (const ev of events) {
          if (tSec >= ev.start && tSec <= ev.end) {
            active.add(ev.label);
          }
        }
        return COLOR_LABEL_ORDER.filter((label) => active.has(label));
      };

      const labelAllowedAtBand = (label: string, bandIndex: number) => {
        const f = bandFreqs[bandIndex] ?? 0;
        const fmin = LABEL_FREQ_MIN[label];
        const fmax = LABEL_FREQ_MAX[label];
        if (fmin != null && f < fmin) return false;
        if (fmax != null && f > fmax) return false;
        return true;
      };

      const drawFrame = () => {
        const frameColor = p.color(palette.frame);
        const gridColor = p.color(palette.frame);
        frameColor.setAlpha(45);
        gridColor.setAlpha(25);

        p.stroke(frameColor);
        p.noFill();
        p.rect(
          LEFT_MARGIN,
          TOP_MARGIN,
          p.width - LEFT_MARGIN - RIGHT_MARGIN,
          p.height - TOP_MARGIN - BOTTOM_MARGIN
        );

        const labelColor = p.color(palette.text);
        labelColor.setAlpha(200);
        const guideColor = p.color(gridColor.levels);

        p.textSize(12);
        p.textAlign(p.RIGHT, p.CENTER);
        p.noStroke();
        p.fill(labelColor);

        const ticks = 10;
        for (let j = 0; j <= ticks; j += 1) {
          const frac = j / ticks;
          const visIndex = Math.round(frac * (Math.max(1, VIS_BANDS) - 1));
          const y = p.map(visIndex, 0, VIS_BANDS - 1, p.height - BOTTOM_MARGIN, TOP_MARGIN);
          const freq = frac * effFmax;
          p.fill(labelColor);
          p.text(formatHz(freq), LEFT_MARGIN - 10, y);
          p.stroke(guideColor);
          p.line(LEFT_MARGIN, y, p.width - RIGHT_MARGIN, y);
          p.noStroke();
        }
      };

      const getCurrentEventAtTime = (tSec: number) => {
        if (!events.length) return null;
        let best: EventEntry | null = null;
        for (const ev of events) {
          if (tSec >= ev.start && tSec <= ev.end) {
            if (!best || ev.start > best.start) {
              best = ev;
            }
          }
        }
        return best;
      };

      const drawDetectionsAtPlayhead = (xPos: number, activeLabels: string[]) => {
        if (!activeLabels.length) return;
        p.noStroke();
        for (const label of activeLabels) {
          const col = LABEL_COLORS[label] || '#FFFFFF';
          const c = p.color(col);
          c.setAlpha(MARKER_ALPHA);
          p.fill(c);
          const ry = LABEL_MARKER_Y[label] ?? MARKER_Y_DEFAULT;
          const rr = LABEL_MARKER_R[label] ?? MARKER_RADIUS_DEF;
          p.circle(xPos, ry, rr * 2);
        }

        if (!SHOW_LABEL_TEXT) return;
        p.textAlign(p.CENTER, p.BASELINE);
        p.textSize(LABEL_TEXT_SIZE);
        for (const label of activeLabels) {
          const col = LABEL_COLORS[label] || '#FFFFFF';
          p.fill(col);
          const ty = LABEL_TEXT_Y[label] ?? LABEL_TEXT_Y_DEFAULT;
          p.text(label, xPos, ty);
        }
      };

      const drawNowPlaying = (event: EventEntry | null) => {
        if (!SHOW_NOW_PLAYING) return;
        const nowMs = p.millis();
        const incomingLabel = event?.label ?? null;
        const incomingLogits = event && Number.isFinite(event.logits ?? NaN) ? event.logits : null;

        if (incomingLabel && incomingLabel !== npLabel) {
          npLabel = incomingLabel;
          npLogits = incomingLogits ?? null;
          npAlpha = 0;
          npChangedAt = nowMs;
        } else if (incomingLabel && incomingLabel === npLabel) {
          npLogits = incomingLogits ?? npLogits;
        }

        if (!npLabel) return;

        if (npAlpha < 1) {
          const t = (nowMs - npChangedAt) / NP_FADE_MS;
          npAlpha = p.constrain(t, 0, 1);
        }

        p.noStroke();
        const bg = p.color(palette.background);
        bg.setAlpha(255);
        p.fill(bg);
        p.rect(NOW_X - 12, NOW_Y - 28, 420, 50, 6);

        const col = LABEL_COLORS[npLabel] || '#FFFFFF';
        const c = p.color(col);
        c.setAlpha(NOW_TEXT_ALPHA * npAlpha);
        p.fill(c);
        p.textSize(NOW_TEXT_SIZE);
        p.textAlign(p.LEFT, p.BOTTOM);
        const logitsStr =
          npLogits != null && Number.isFinite(npLogits)
            ? ` → logits: ${p.nf(npLogits, 1, 3)}  `
            : '';
        p.text(`${npLabel}${logitsStr}`, NOW_X, NOW_Y);
      };

      const parseEvents = () => {
        if (!eventsTable) return;
        events = [];
        for (let r = 0; r < eventsTable.getRowCount(); r += 1) {
          const row = eventsTable.getRow(r);
          const label = row.getString('label');
          const offset = parseFloat(row.getString('new_offset_sec'));
          if (!Number.isFinite(offset) || !label) continue;
          const win = EVENT_WINDOWS[label] ?? 2.0;
          let logits: number | null = null;
          try {
            const raw = row.getString('logits');
            const parsed = raw != null && raw !== '' ? Number.parseFloat(raw) : NaN;
            logits = Number.isFinite(parsed) ? parsed : null;
          } catch (error) {
            logits = null;
          }
          let utcMs: number | null = null;
          try {
            utcMs = parseUTCtoMs(row.getString('_det_time_utc'));
          } catch (error) {
            utcMs = null;
          }
          events.push({
            start: Math.max(0, offset),
            end: Math.max(0, offset) + win,
            label,
            logits,
            utcMs
          });
        }
        events.sort((a, b) => a.start - b.start);
      };

      p.preload = () => {
        snd = p.loadSound(audioAssetUrl);
        eventsTable = p.loadTable(eventsCsvUrl, 'csv', 'header');
      };

      p.setup = () => {
        const canvas = p.createCanvas(CANVAS_W, CANVAS_H);
        canvas.parent(container);
        canvas.elt.classList.add('dayview-canvas');
        canvas.elt.setAttribute('role', 'img');
        canvas.elt.setAttribute('aria-label', 'Audio spectrum visualization');
        canvas.elt.style.width = '100%';
        canvas.elt.style.height = 'auto';
        p.frameRate(60);

        p.background(palette.background);

        const FFTCtor = (P5Ctor as any).FFT;
        fft = new FFTCtor(FFT_SMOOTHING, FFT_SIZE);
        fft.setInput(snd);

        snd.loop();
        stopAudio = () => {
          try {
            snd?.stop();
            snd?.disconnect();
          } catch (error) {
            console.warn('Failed to stop audio', error);
          }
        };

        if (p.getAudioContext().state !== 'running') {
          needClickHint = true;
        }

        const nyquist = p.getAudioContext().sampleRate / 2;
        effFmax = Math.min(FREQ_MAX_HZ, nyquist);
        VIS_BANDS = Math.max(1, Math.floor(BANDS * (effFmax / nyquist)));

        baseline = new Array(VIS_BANDS).fill(10);
        prevEnergy = new Array(VIS_BANDS).fill(0);
        bandFreqs = new Array(VIS_BANDS);
        for (let i = 0; i < VIS_BANDS; i += 1) {
          bandFreqs[i] = (i / Math.max(1, VIS_BANDS - 1)) * effFmax;
        }

        const plotW = p.width - LEFT_MARGIN - RIGHT_MARGIN;
        pxPerMs = plotW / (SECONDS_ACROSS * 1000);
        x = LEFT_MARGIN;

        baselineInit();
        parseEvents();
        drawFrame();
      };

      p.draw = () => {
        if (p.frameCount % 30 === 0) {
          updateThemeIfNeeded();
        }

        if (needsRefresh) {
          needsRefresh = false;
          x = LEFT_MARGIN;
          p.background(palette.background);
          drawFrame();
        }

        const plotRight = p.width - RIGHT_MARGIN;
        x += pxPerMs * p.deltaTime;
        if (x > plotRight) {
          x = LEFT_MARGIN;
          p.background(palette.background);
          drawFrame();
        }

        baselineTick();

        let tSec = 0;
        try {
          const duration = snd?.duration?.() ?? 0;
          const current = snd?.currentTime?.() ?? 0;
          tSec = duration && Number.isFinite(duration) && duration > 0 ? current % duration : current;
        } catch (error) {
          tSec = 0;
        }

        const activeLabels = getActiveLabelsAtTime(tSec);
        const nowEvent = getCurrentEventAtTime(tSec);

        const spectrum: number[] = fft.analyze(BANDS);

        for (let i = 0; i < VIS_BANDS; i += 1) {
          const y = p.map(i, 0, VIS_BANDS - 1, p.height - BOTTOM_MARGIN, TOP_MARGIN);
          const e = spectrum[i];
          const lerpAmt = baselineReady ? 0 : BASELINE_LERP;
          baseline[i] = p.lerp(baseline[i], e, lerpAmt);

          const above = Math.max(0, e - baseline[i]);
          const energyNorm = Math.pow(Math.min(1, above / 255), GAMMA);
          const delta = Math.max(0, e - prevEnergy[i]);
          const changeNorm = Math.pow(Math.min(1, delta / 40), GAMMA);
          prevEnergy[i] = e;

          let metric = ENERGY_GAIN * energyNorm + CHANGE_GAIN * changeNorm;

          if (above < NOISE_MARGIN && metric < TRIGGER) {
            p.stroke(palette.quiet);
            p.strokeWeight(1);
            p.point(x, y);
            continue;
          }

          metric = Math.min(1, metric);
          const radius = QUIET_RADIUS + MAX_RADIUS * metric;
          const strokeWidth = 1 + (MAX_STROKE - 1) * energyNorm;

          p.stroke(palette.ambient);
          p.strokeWeight(strokeWidth);
          p.noFill();

          for (let k = 0; k < DOTS_PER_BAND; k += 1) {
            const angle = p.random(p.TWO_PI);
            const rr = radius * (1 - p.random(p.random(1)));
            p.point(x + p.cos(angle) * rr, y + p.sin(angle) * rr);
          }

          if (activeLabels.length) {
            for (const label of activeLabels) {
              if (!labelAllowedAtBand(label, i)) continue;
              const col = LABEL_COLORS[label] || '#FFFFFF';
              p.stroke(col);
              const weight = LABEL_WEIGHTS[label] ?? LABEL_WEIGHTS.default;
              p.strokeWeight(strokeWidth * (COLOR_STROKE_BOOST || 1) * weight);
              const extraDots = Math.max(1, Math.floor(DOTS_PER_BAND * 0.8));
              for (let k = 0; k < extraDots; k += 1) {
                const angle = p.random(p.TWO_PI);
                const rr =
                  radius * (COLOR_RADIUS_BOOST || 1) * (1 - p.random(p.random(1)));
                p.point(x + p.cos(angle) * rr, y + p.sin(angle) * rr);
              }
            }
          }
        }

        drawDetectionsAtPlayhead(x, activeLabels);
        drawUtcHourTimer(nowEvent);

        if (SHOW_NOW_PLAYING) {
          p.noStroke();
          const bg = p.color(palette.background);
          bg.setAlpha(255);
          p.fill(bg);
          p.rect(NOW_X - 12, NOW_Y - 28, 420, 50, 6);
        }

        drawNowPlaying(nowEvent);

        if (needClickHint) {
          p.noStroke();
          const hintColor = p.color(palette.text);
          hintColor.setAlpha(220);
          p.fill(hintColor);
          p.textSize(14);
          p.textAlign(p.LEFT, p.TOP);
          p.text('Click canvas once to enable audio', 16, 16);
        }

        drawBaselineStatus();
      };

      p.mousePressed = () => {
        if (p.getAudioContext().state !== 'running') {
          void p.getAudioContext().resume();
          needClickHint = false;
        }
      };
    }, container);

    const observer = new MutationObserver(() => {
      requestRefresh?.();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return {
      sketch,
      cleanup() {
        try {
          stopAudio?.();
        } catch (error) {
          console.warn('Failed to stop audio', error);
        }
        observer.disconnect();
      }
    };
  }
</script>

<section class="day-view" aria-live="polite">
  <div class="legend" aria-label="Sound type legend">
    <div class="legend-items">
      {#each soundTypes as type}
        <LegendItem type={type} status={typeStatuses[type]} />
      {/each}
    </div>
  </div>

  {#if formattedDate}
    <!-- <header class="day-header">
      <h1 class="font-mono">{formattedDate}</h1>
    </header> -->
      <div class="sketch-canvas" bind:this={canvasParent}></div>
  {:else}
    <article class="empty-state">
      <h2>No day selected</h2>
      <p>Choose a day from the month grid to preview its hourly breakdown.</p>
    </article>
  {/if}
</section>

<style>
  .day-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-height: 0;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

    .legend-items {
        display: flex;
        /* flex-wrap: wrap; */
        gap: 1rem;
        margin: 0 1rem 0 2rem;
    }

  .sketch-canvas {
    width: 100%;
    overflow: hidden;
  }

  :global(canvas.dayview-canvas) {
    width: 100% !important;
    height: auto !important;
    display: block;
    border-radius: 0.75rem;
    background: transparent;
  }

  .empty-state {
    border-radius: 1rem;
    border: 1px dashed var(--border-subtle, rgba(100, 116, 139, 0.4));
    padding: 2rem;
    background: var(--surface-overlay, rgba(15, 23, 42, 0.04));
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    color: var(--text-secondary, #334155);
  }

  .empty-state p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.6;
  }

  .empty-state h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

</style>
