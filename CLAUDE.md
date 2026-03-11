# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start both Vite dev server (port 5173) + Express API (port 3001) concurrently
npm run dev:client   # Vite dev server only
npm run dev:server   # Express server only
npm run build        # Production build (outputs to dist/)
npm start            # Serve built frontend + API from Express on port 3001
```

No lint or test scripts are configured.

## Architecture

Full-stack raffle tracker for Chymist Press at GalaxyCon 2026 ("The Fence's Ledger").
React frontend + Express backend + SQLite database.

### Frontend (`src/`)
- **`src/App.jsx`** — Single monolithic component managing all UI state and views. Uses React hooks only (no external state library).
- Views: `main`, `pay`, `pending`, `confirm`, `add`, `admin`, `list`, `draw`, `winner`
- Custom fetch wrapper `api()` talks to `/api/*` endpoints
- Vite proxies `/api` → `http://localhost:3001` in dev
- SSE via `EventSource('/api/events')` — listens for `entry` events to show real-time payment confirmation

### Backend (`server/`)
- **`server/index.js`** — Express server with better-sqlite3. Database auto-created at `server/raffle.db` (WAL mode).
- Schema: `entrants` table (id, name, email, phone, newsletter bool, purchase enum, entries int, square_payment_id, created_at) and `winners` table (id, entrant_id FK, drawn_at)
- Square webhook endpoint must be registered **before** `app.use(express.json())` to preserve raw body for signature verification

### Square Two-Device Payment Flow
Square Reader on phone handles tap-to-pay (Square app, not web SDK). The SBC runs the raffle web app.

1. Staff enters customer name/newsletter/product in the `pay` view → clicks "Ready to Pay"
2. Frontend POSTs to `/api/pending-entry` — stored in-memory Map with 3-min TTL
3. Frontend switches to `pending` view with animated countdown
4. Staff processes payment on phone with Square Reader
5. Square sends `payment.completed` webhook to server
6. Server matches `payment.amount_money.amount` (in cents) → purchase level via `AMOUNT_TO_PURCHASE` map
7. Server pops the oldest pending entry (matched by timing — sequential booth service)
8. `createEntry()` inserts into DB with idempotency guard on `square_payment_id`
9. Server broadcasts `entry` SSE event to all connected browsers
10. Frontend receives SSE, checks `viewRef.current === 'pending'`, shows confirmation

### Key API Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/square/config` | Returns `{ enabled: bool }` |
| POST | `/api/pending-entry` | Register pending customer (name, newsletter, product) → returns token |
| DELETE | `/api/pending-entry/:token` | Cancel pending entry |
| GET | `/api/events` | SSE stream — broadcasts `entry` events on webhook |
| GET | `/api/entrants` | List all entrants |
| POST | `/api/entrants` | Manual add (requires name + email or phone) |
| PATCH | `/api/entrants/:id` | Update entrant |
| DELETE | `/api/entrants/:id` | Delete entrant |
| GET | `/api/stats` | Aggregated stats |
| POST | `/api/draw` | Weighted random draw |
| GET | `/api/winners` | List winners |
| DELETE | `/api/winners/last` | Undo last draw |
| GET | `/api/export` | CSV export |

### Entry Count Logic
- Newsletter signup: +1 entry
- `hook_crook` (By Hook & Crook, $15): +2 entries
- `thiefcatcher` (Thiefcatcher, $17): +2 entries
- `both_books` (bundle, $30): +5 entries

The draw pools entries weighted by count (each entry = one ticket in the pool). Prize tiers are drawn in sequence: 20 third prizes → 4 second prizes → 2 grand prizes.

### Static Assets
- `public/prizes/` — drop `grand.jpg`, `second.jpg`, `third.jpg`
- `public/books/` — drop `hook-crook.jpg`, `thiefcatcher.jpg`, `bundle.jpg`
