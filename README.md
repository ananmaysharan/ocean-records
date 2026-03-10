# Ocean Records

An interactive data visualization platform exploring underwater sound monitoring data from **Monterey Bay, California**. The app visualizes both biophony (animal sounds) and anthropogenic sounds (human-made noise) detected across three underwater sensor locations, letting users navigate temporal scales from yearly overviews down to hourly breakdowns.

## Details

View full case study [here](https://ananmay.net/work/ocean-records).


## Data

Acoustic monitoring data is organized per sensor (`mb01/`, `mb02/`, `mb03/`) at three temporal resolutions:

- `month_level_summary.csv` — Monthly aggregates
- `day_level_summary.csv` — Daily aggregates
- `hour_level_summary.csv` — Hourly breakdowns

Each CSV contains columns for time and detection counts across all nine sound categories. Data spans from November 2018 onward.

Sensor locations are defined in `sensors.geo.json`. Audio samples are stored as WAV files in `src/lib/assets/sounds/`.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Mapbox](https://www.mapbox.com/) access token

### Environment Setup

Create a `.env` file in the project root:

```
VITE_MAPBOX_TOKEN=your_mapbox_access_token_here
```

### Install & Run

```sh
npm install
npm run dev

# or open in the browser automatically
npm run dev -- --open
```

## Notes

- The app is optimized for desktop viewports. 
