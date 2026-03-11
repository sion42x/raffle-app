import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ── Database setup ───────────────────────────────────────────────

const db = new Database(join(__dirname, 'raffle.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migrations
try { db.exec(`ALTER TABLE entrants ADD COLUMN qty INTEGER NOT NULL DEFAULT 1`); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS entrants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    newsletter INTEGER NOT NULL DEFAULT 0,
    purchase TEXT NOT NULL DEFAULT 'none',
    qty INTEGER NOT NULL DEFAULT 1,
    entries INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entrant_id INTEGER NOT NULL REFERENCES entrants(id),
    drawn_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// ── Helpers ──────────────────────────────────────────────────────

function calcEntries(newsletter, purchase, qty = 1) {
  const map = { none: 0, hook_crook: 2, thiefcatcher: 2, both_books: 5, one_book: 2 };
  return (newsletter ? 1 : 0) + (map[purchase] || 0) * qty;
}

async function subscribeToBeehiiv(email) {
  const key = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!key || !pubId || !email) return;
  try {
    await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ email, reactivate_existing: false, send_welcome_email: true, utm_source: 'galaxycon-2026' }),
    });
  } catch {}
}

// ── Middleware ───────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Entrant routes ───────────────────────────────────────────────

app.get('/api/entrants', (req, res) => {
  const entrants = db.prepare(`
    SELECT e.*,
      CASE WHEN w.id IS NOT NULL THEN 1 ELSE 0 END as is_winner,
      w.drawn_at as won_at
    FROM entrants e
    LEFT JOIN winners w ON w.entrant_id = e.id
    ORDER BY e.created_at DESC
  `).all();
  res.json(entrants);
});

app.post('/api/entrants', async (req, res) => {
  const { name, email, phone, newsletter, purchase, qty } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) return res.status(400).json({ error: 'Invalid email address' });
  if (phone?.trim()) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return res.status(400).json({ error: 'Phone number looks too short' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM entrants WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'That email is already in the raffle' });

  const nl = newsletter ? 1 : 0;
  const purch = purchase || 'none';
  const q = Math.max(1, parseInt(qty) || 1);
  const entries = calcEntries(nl, purch, q);
  if (entries === 0) return res.status(400).json({ error: 'Select at least newsletter or a purchase' });

  const result = db.prepare(`
    INSERT INTO entrants (name, email, phone, newsletter, purchase, qty, entries)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), normalizedEmail, (phone || '').trim(), nl, purch, q, entries);

  const entrant = db.prepare('SELECT * FROM entrants WHERE id = ?').get(result.lastInsertRowid);
  if (nl && entrant.email) subscribeToBeehiiv(entrant.email);
  res.status(201).json(entrant);
});

app.patch('/api/entrants/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM entrants WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const newsletter = req.body.newsletter !== undefined ? (req.body.newsletter ? 1 : 0) : existing.newsletter;
  const purchase   = req.body.purchase  !== undefined ? req.body.purchase  : existing.purchase;
  const qty        = req.body.qty       !== undefined ? Math.max(1, parseInt(req.body.qty) || 1) : (existing.qty || 1);
  const name       = req.body.name      !== undefined ? req.body.name.trim() : existing.name;
  const email      = req.body.email     !== undefined ? req.body.email.trim().toLowerCase() : existing.email;
  const phone      = req.body.phone     !== undefined ? req.body.phone.trim() : existing.phone;

  db.prepare(`
    UPDATE entrants SET name=?, email=?, phone=?, newsletter=?, purchase=?, qty=?, entries=? WHERE id=?
  `).run(name, email, phone, newsletter, purchase, qty, calcEntries(newsletter, purchase, qty), req.params.id);

  res.json(db.prepare('SELECT * FROM entrants WHERE id = ?').get(req.params.id));
});

app.delete('/api/entrants/:id', (req, res) => {
  db.prepare('DELETE FROM winners WHERE entrant_id = ?').run(req.params.id);
  const result = db.prepare('DELETE FROM entrants WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

// ── Stats & raffle ───────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const total        = db.prepare('SELECT COUNT(*) as n FROM entrants').get().n;
  const totalEntries = db.prepare('SELECT COALESCE(SUM(entries),0) as n FROM entrants').get().n;
  const newsletter   = db.prepare('SELECT COUNT(*) as n FROM entrants WHERE newsletter=1').get().n;
  const hookCrook    = db.prepare("SELECT COUNT(*) as n FROM entrants WHERE purchase IN ('hook_crook','one_book')").get().n;
  const thiefcatcher = db.prepare("SELECT COUNT(*) as n FROM entrants WHERE purchase='thiefcatcher'").get().n;
  const bothBooks    = db.prepare("SELECT COUNT(*) as n FROM entrants WHERE purchase='both_books'").get().n;
  const winnersCount = db.prepare('SELECT COUNT(*) as n FROM winners').get().n;
  res.json({ total, totalEntries, newsletter, hookCrook, thiefcatcher, bothBooks, winnersCount });
});

app.post('/api/draw', (req, res) => {
  const eligible = db.prepare(`
    SELECT e.* FROM entrants e LEFT JOIN winners w ON w.entrant_id=e.id WHERE w.id IS NULL
  `).all();
  if (!eligible.length) return res.status(400).json({ error: 'No eligible entrants remaining' });

  const pool = eligible.flatMap(e => Array(e.entries).fill(e));
  const winner = pool[Math.floor(Math.random() * pool.length)];
  db.prepare('INSERT INTO winners (entrant_id) VALUES (?)').run(winner.id);
  res.json(winner);
});

app.get('/api/winners', (req, res) => {
  res.json(db.prepare(`
    SELECT e.*, w.drawn_at, w.id as winner_id
    FROM winners w JOIN entrants e ON e.id=w.entrant_id ORDER BY w.drawn_at ASC
  `).all());
});

app.delete('/api/winners/last', (req, res) => {
  const last = db.prepare('SELECT id FROM winners ORDER BY id DESC LIMIT 1').get();
  if (!last) return res.status(400).json({ error: 'No winners to undo' });
  db.prepare('DELETE FROM winners WHERE id=?').run(last.id);
  res.json({ undone: true });
});

// ── Export ───────────────────────────────────────────────────────

app.get('/api/export', (req, res) => {
  const entrants = db.prepare('SELECT * FROM entrants ORDER BY created_at DESC').all();
  const header = 'Name,Email,Phone,Newsletter,Purchase,Entries,Created\n';
  const rows = entrants.map(e =>
    `"${e.name}","${e.email}","${e.phone}",${e.newsletter?'Yes':'No'},${e.purchase},${e.entries},"${e.created_at}"`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=galaxycon-raffle-export.csv');
  res.send(header + rows);
});

app.get('/api/export/newsletter', (req, res) => {
  const subs = db.prepare("SELECT name, email FROM entrants WHERE newsletter=1 AND email != '' ORDER BY created_at ASC").all();
  const header = 'Name,Email\n';
  const rows = subs.map(e => `"${e.name}","${e.email}"`).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=galaxycon-newsletter-signups.csv');
  res.send(header + rows);
});

// ── Serve built frontend in production ───────────────────────────

if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Raffle server: http://localhost:${PORT}`);
});
