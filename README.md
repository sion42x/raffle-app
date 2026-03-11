# The Fence's Ledger — GalaxyCon Raffle Tracker

Thieves' guild themed raffle tracker for booth operations.

## Setup

```bash
npm install
npm run dev
```

This starts both the Vite dev server (port 5173) and the Express API (port 3001).
Open http://localhost:5173

## How It Works

- **Newsletter signup** = 1 raffle entry
- **Buy 1 book** = 2 entries
- **Buy both books** = 5 entries
- Entries stack: newsletter + both books = 6 entries

Data is stored in `server/raffle.db` (SQLite). The DB file is auto-created on first run.

## Production Build

```bash
npm run build
npm start
```

Serves the built frontend + API from port 3001.

## Export

Hit the **Export CSV** button on the main screen to download all entrant data.
The CSV includes name, email, phone, newsletter status, purchase type, entries, and timestamp.

## Database

The SQLite database lives at `server/raffle.db`. Back it up if you want to preserve data between machines — just copy the file.
# raffle-app
