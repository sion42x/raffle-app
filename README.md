# The Fence's Ledger — GalaxyCon Raffle Tracker

Thieves' guild themed raffle tracker for Chymist Press booth operations at GalaxyCon 2026.

React + Express + SQLite, containerized with Docker.

---

## Running with Docker (primary workflow)

### First-time setup / after any code changes

```bash
docker compose up -d --build
```

This rebuilds the image from the `Dockerfile` and restarts the container. **Always run with `--build` when you've changed any source files.**

### Start existing container (no code changes)

```bash
docker compose up -d
```

### Stop

```bash
docker compose down
```

The app is served on **http://localhost:3001**.

Data is persisted in a named Docker volume (`raffle-data`) mapped to `/app/data/raffle.db` inside the container. The volume survives `docker compose down` — only `docker compose down -v` would destroy it.

---

## Local development (no Docker)

```bash
npm install
npm run dev
```

Starts the Vite dev server (port 5173) + Express API (port 3001) concurrently. Open http://localhost:5173.

| Command | Description |
|---|---|
| `npm run dev` | Both servers (Vite + Express) |
| `npm run dev:client` | Vite only |
| `npm run dev:server` | Express only |
| `npm run build` | Production build → `dist/` |
| `npm start` | Serve built frontend + API from port 3001 |

---

## Entry count logic

- Newsletter signup → **+1 entry**
- By Hook & Crook ($15) → **+2 entries**
- Thiefcatcher ($17) → **+2 entries**
- Both Books bundle ($30) → **+5 entries**

Entries stack: newsletter + both books = 6 entries total.

---

## Square payment integration

Square Reader on a phone handles tap-to-pay. The web app runs on a separate device (SBC/laptop).

1. Staff enters customer info in the **Pay** view → "Ready to Pay"
2. A pending entry is held in memory (3-minute TTL)
3. Staff processes payment on the Square Reader
4. Square fires a `payment.completed` webhook to the server
5. Server matches the payment amount to a purchase level, pops the pending entry, writes to DB
6. SSE broadcasts a confirmation to all connected browsers

Set `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_ACCESS_TOKEN` in your environment (or a `.env` file) to enable webhook verification.

---

## Static assets

Drop image files before building/deploying:

| File | Used for |
|---|---|
| `public/prizes/grand.jpg` | Grand prize winner screen |
| `public/prizes/second.jpg` | Second prize winner screen |
| `public/prizes/third.jpg` | Third prize winner screen |
| `public/books/hook-crook.jpg` | By Hook & Crook cover |
| `public/books/thiefcatcher.jpg` | Thiefcatcher cover |
| `public/books/bundle.jpg` | Bundle cover |

---

## Database

SQLite at `server/raffle.db` locally, or `/app/data/raffle.db` inside Docker (persisted via volume).

To back up the database from the running container:

```bash
docker compose cp raffle:/app/data/raffle.db ./raffle-backup.db
```

To restore:

```bash
docker compose cp ./raffle-backup.db raffle:/app/data/raffle.db
```

---

## Export

Hit **Export CSV** on the main screen to download all entrant data (name, email, phone, newsletter status, purchase type, entries, timestamp).
