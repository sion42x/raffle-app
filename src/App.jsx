import { useState, useEffect, useCallback, useRef } from 'react';
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import { QRCodeSVG } from 'qrcode.react';

const PURCHASE_LEVELS = {
  none:        { label: 'No Purchase',       entries: 0, icon: '—',  price: 0  },
  hook_crook:  { label: 'By Hook & Crook',   entries: 2, icon: '📕', price: 15 },
  thiefcatcher:{ label: 'Thiefcatcher',      entries: 2, icon: '📗', price: 17 },
  both_books:  { label: 'Both Books',        entries: 5, icon: '📚', price: 30 },
  // legacy value — kept for any existing DB rows
  one_book:    { label: '1 Book',            entries: 2, icon: '📕', price: 15 },
};

function calcTotal(purchase, qty) {
  return (PURCHASE_LEVELS[purchase]?.price || 0) * qty;
}

const BOOKS = [
  { key: 'hook_crook',   title: 'By Hook & Crook', price_label: '$15', cover: '/books/hook-crook.jpg',   entries: 2 },
  { key: 'thiefcatcher', title: 'Thiefcatcher',     price_label: '$17', cover: '/books/thiefcatcher.jpg', entries: 2 },
  { key: 'both_books',   title: 'Both Books',       price_label: '$30', cover: '/books/bundle.jpg',       entries: 5, bundle: true },
];

const PRIZES = [
  { tier: 'grand',  label: 'Grand Prize',  count: 2,  description: '1kg Copper Bar',              detail: 'Azorian Mint',     image: '/prizes/grand.jpg'  },
  { tier: 'second', label: 'Second Prize', count: 4,  description: '2oz Copper Round',             detail: 'Azorian Mint',     image: '/prizes/second.jpg' },
  { tier: 'third',  label: 'Third Prize',  count: 20, description: 'Copper-Plated Challenge Coin', detail: 'Character Series', image: '/prizes/third.jpg'  },
];

const PRIZE_THRESHOLDS = PRIZES.reduce((acc, p, i) => {
  acc.push((acc[i - 1] ?? 0) + p.count);
  return acc;
}, []);

function prizeTierForDraw(winnersCount) {
  for (let i = 0; i < PRIZES.length; i++) {
    if (winnersCount < PRIZE_THRESHOLDS[i]) return PRIZES[i];
  }
  return null;
}

function prizeTierForWinner(winnerIndex) {
  for (let i = 0; i < PRIZES.length; i++) {
    if (winnerIndex < PRIZE_THRESHOLDS[i]) return PRIZES[i];
  }
  return null;
}

function calcEntries(newsletter, purchase, qty = 1) {
  return (newsletter ? 1 : 0) + (PURCHASE_LEVELS[purchase]?.entries || 0) * qty;
}

function entrantSummary(e) {
  const parts = [];
  if (e.newsletter) parts.push('📜 Newsletter');
  if (e.purchase && e.purchase !== 'none')
    parts.push(PURCHASE_LEVELS[e.purchase].icon + ' ' + PURCHASE_LEVELS[e.purchase].label);
  return parts.length ? parts.join(' + ') : '—';
}

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.headers.get('content-type')?.includes('text/csv')) return res.text();
  return res.json();
}

// ── Themed primitives ─────────────────────────────────────────────

function Badge({ children, color = '#c87533' }) {
  return (
    <span style={{
      display: 'inline-block', background: color, color: '#1a1a1a',
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      fontFamily: "'Courier Prime', monospace",
    }}>
      {children}
    </span>
  );
}

// ── Theme ─────────────────────────────────────────────────────────

const theme = {
  bg: '#0f0e0c',
  surface: '#1a1815',
  surfaceHover: '#242018',
  border: '#2e2a22',
  copper: '#c87533',
  copperLight: '#e8a85c',
  copperDark: '#8b5220',
  gold: '#d4a849',
  text: '#e8dcc8',
  textMuted: '#8a7e6e',
  danger: '#a33',
  success: '#4a7a3a',
};

const baseInput = {
  width: '100%',
  padding: '18px 20px',
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  color: theme.text,
  fontSize: 20,
  fontFamily: "'Courier Prime', monospace",
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const baseButton = {
  padding: '16px 28px',
  border: 'none',
  borderRadius: 6,
  fontSize: 17,
  fontWeight: 700,
  fontFamily: "'Courier Prime', monospace",
  cursor: 'pointer',
  letterSpacing: '0.03em',
  transition: 'all 0.15s',
  textTransform: 'uppercase',
};

function PrizeCard({ prize, won = 0, highlight = false }) {
  const [imgErr, setImgErr] = useState(false);
  const remaining = prize.count - won;
  return (
    <div style={{
      flex: 1, background: theme.surface,
      border: `1px solid ${highlight ? theme.gold : theme.border}`,
      borderRadius: 4, overflow: 'hidden',
      boxShadow: highlight ? `0 0 16px ${theme.gold}33` : 'none',
      transition: 'box-shadow 0.3s',
    }}>
      <div style={{ width: '100%', aspectRatio: '4/3', background: theme.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!imgErr ? (
          <img src={prize.image} alt={prize.label} onError={() => setImgErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ color: theme.copperDark, fontSize: 11, textAlign: 'center', padding: 8, fontFamily: "'Courier Prime', monospace" }}>
            No image<br />{prize.image.split('/').pop()}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 12, color: highlight ? theme.gold : theme.copper, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>
          {prize.label}
        </div>
        <div style={{ fontSize: 15, color: theme.text, lineHeight: 1.3, marginBottom: 3 }}>{prize.description}</div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>{prize.detail}</div>
        <div style={{ marginTop: 8, fontSize: 13, color: remaining > 0 ? theme.copperLight : theme.textMuted }}>
          {remaining}/{prize.count} remaining
        </div>
      </div>
    </div>
  );
}

function SelectionTile({ label, sublabel, image, icon, selected, onClick, qty, onQtyChange }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 0, cursor: 'pointer', textAlign: 'left',
      background: selected ? `${theme.copper}18` : theme.surface,
      border: `2px solid ${selected ? theme.copper : theme.border}`,
      borderRadius: 6, overflow: 'hidden',
      boxShadow: selected ? `0 0 16px ${theme.copper}44` : 'none',
      transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
      fontFamily: "'Courier Prime', monospace",
    }}>
      <div style={{ height: 220, background: theme.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {image && !imgErr
          ? <img src={image} alt={label} onError={() => setImgErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          : <span style={{ fontSize: 48 }}>{icon}</span>
        }
      </div>
      <div style={{ padding: '12px 14px', background: selected ? `${theme.copper}11` : 'transparent', transition: 'background 0.15s', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: selected ? theme.copperLight : theme.text, marginBottom: 3 }}>
          {label}
        </div>
        {selected && onQtyChange ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onQtyChange(Math.max(1, qty - 1)); }}
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 4, width: 28, height: 28, cursor: 'pointer', fontFamily: "'Courier Prime', monospace", fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >−</button>
            <span style={{ fontSize: 16, color: theme.copperLight, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{qty}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onQtyChange(qty + 1); }}
              style={{ background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 4, width: 28, height: 28, cursor: 'pointer', fontFamily: "'Courier Prime', monospace", fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >+</button>
            <span style={{ fontSize: 12, color: theme.copper, marginLeft: 2 }}>{sublabel.split(' · ')[1]}</span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: selected ? theme.copper : theme.textMuted }}>
            {sublabel}
          </div>
        )}
      </div>
    </button>
  );
}

function BookCard({ book, selected, onClick }) {
  const [imgErr, setImgErr] = useState(false);
  const [hookErr, setHookErr] = useState(false);
  const [thiefErr, setThiefErr] = useState(false);

  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 0, background: 'none', cursor: 'pointer',
      border: `2px solid ${selected ? theme.copper : theme.border}`,
      borderRadius: 4, overflow: 'hidden', textAlign: 'left',
      transition: 'border-color 0.15s',
      boxShadow: selected ? `0 0 12px ${theme.copper}33` : 'none',
      fontFamily: "'Courier Prime', monospace",
    }}>
      {/* Cover */}
      <div style={{ width: '100%', aspectRatio: '2/3', background: theme.bg, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {book.bundle && !imgErr ? (
          <img src={book.cover} alt={book.title} onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : book.bundle && imgErr ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {!hookErr
              ? <img src="/books/hook-crook.jpg" alt="By Hook & Crook" onError={() => setHookErr(true)} style={{ flex: 1, objectFit: 'cover', height: '100%' }} />
              : <div style={{ flex: 1, background: theme.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 24 }}>📕</span></div>
            }
            {!thiefErr
              ? <img src="/books/thiefcatcher.jpg" alt="Thiefcatcher" onError={() => setThiefErr(true)} style={{ flex: 1, objectFit: 'cover', height: '100%' }} />
              : <div style={{ flex: 1, background: theme.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 24 }}>📗</span></div>
            }
          </div>
        ) : !imgErr ? (
          <img src={book.cover} alt={book.title} onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ color: theme.copperDark, fontSize: 11, textAlign: 'center', padding: 8 }}>
            {PURCHASE_LEVELS[book.key]?.icon ?? '📕'}
          </div>
        )}
        {book.bundle && (
          <div style={{ position: 'absolute', top: 6, right: 6, background: theme.gold, color: '#1a1a1a', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 2, letterSpacing: '0.05em' }}>
            BUNDLE
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '14px 12px 16px', background: selected ? `${theme.copper}11` : 'transparent', transition: 'background 0.15s' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: selected ? theme.copperLight : theme.text, lineHeight: 1.3, marginBottom: 6 }}>
          {book.title}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: selected ? theme.copper : theme.textMuted, marginBottom: 4 }}>
          {book.price_label}
        </div>
        <div style={{ fontSize: 13, color: theme.textMuted }}>
          +{book.entries} {book.entries === 1 ? 'entry' : 'entries'}
          {book.bundle && <span style={{ color: theme.gold }}> ★ bonus entry</span>}
        </div>
      </div>
    </button>
  );
}

// ── PIN Modal ─────────────────────────────────────────────────────

const ADMIN_PIN = '1555';

function PinModal({ onSuccess, onCancel }) {
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(false);

  const press = (digit) => {
    if (entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    if (next.length === 4) {
      if (next === ADMIN_PIN) {
        onSuccess();
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setEntered(''); }, 600);
      }
    }
  };

  const keys = ['1','2','3','4','5','6','7','8','9','←','0','✓'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`}</style>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '36px 40px', width: 300, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 24 }}>Staff PIN</div>

        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 28, animation: shake ? 'shake 0.5s ease' : 'none' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < entered.length ? theme.copper : theme.border, transition: 'background 0.15s' }} />
          ))}
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {keys.map((k) => (
            <button key={k} onClick={() => k === '←' ? setEntered(e => e.slice(0,-1)) : k === '✓' ? null : press(k)}
              style={{ ...baseButton, padding: '18px 0', fontSize: 20, background: k === '✓' ? theme.border : theme.surfaceHover, border: `1px solid ${theme.border}`, color: k === '←' ? theme.copper : theme.text, borderRadius: 6 }}
            >{k}</button>
          ))}
        </div>

        <button onClick={onCancel} style={{ marginTop: 20, background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontFamily: "'Courier Prime', monospace", fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Payment Modal ─────────────────────────────────────────────────

function QRTile({ label, url, color, unconfigured }) {
  return (
    <div style={{
      flex: 1, background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{ width: '100%', aspectRatio: '1/1', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, boxSizing: 'border-box' }}>
        {unconfigured
          ? <span style={{ fontSize: 11, color: '#999', textAlign: 'center', padding: 8 }}>Set VITE_{label.toUpperCase().replace(' ', '_')}_* in .env</span>
          : <QRCodeSVG value={url} size={180} bgColor="#ffffff" fgColor="#111111" style={{ width: '100%', height: '100%' }} />
        }
      </div>
      <div style={{ padding: '10px 8px', fontSize: 13, fontWeight: 700, color: color || theme.text, letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'center' }}>
        {label}
      </div>
    </div>
  );
}

const VENMO_USER   = import.meta.env.VITE_VENMO_USERNAME  || '';
const CASHAPP_TAG  = import.meta.env.VITE_CASHAPP_CASHTAG || '';
const SQUARE_APP_ID = import.meta.env.VITE_SQUARE_APP_ID  || '';

function PaymentModal({ purchase, qty, onPaid, onCancel }) {
  const total = calcTotal(purchase, qty);
  const purchaseLabel = PURCHASE_LEVELS[purchase]?.label;
  const note = encodeURIComponent('GalaxyCon Raffle');

  const venmoUrl   = `venmo://paycharge?txn=pay&recipients=${VENMO_USER}&amount=${total}&note=${note}`;
  const cashAppUrl = `https://cash.app/$${CASHAPP_TAG}/${total}`;
  const squareUrl  = SQUARE_APP_ID ? `square-commerce-v1://payment/create?data=${encodeURIComponent(JSON.stringify({
    amount_money: { amount: total * 100, currency_code: 'USD' },
    callback_url: 'https://localhost.local',
    client_id: SQUARE_APP_ID,
    version: '1.3',
    notes: 'GalaxyCon Raffle',
    options: { supported_tender_types: ['CREDIT_CARD', 'CASH', 'OTHER', 'SQUARE_GIFT_CARD'] },
  }))}` : '';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 10, padding: '32px 40px', maxWidth: 860, width: '100%',
        boxShadow: `0 0 60px rgba(0,0,0,0.6)`,
      }}>
        {/* Amount due */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 13, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>
            {purchaseLabel}{qty > 1 ? ` × ${qty}` : ''}
          </div>
          <div style={{ fontSize: 72, fontWeight: 700, color: theme.gold, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1, textShadow: `0 0 40px ${theme.gold}44` }}>
            ${total}
          </div>
          <div style={{ fontSize: 14, color: theme.textMuted, marginTop: 8 }}>Collect payment, then tap Paid</div>
        </div>

        {/* Payment options */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
          <QRTile label="Cash / Credit" url={squareUrl} color="#3c8bcb" unconfigured={!SQUARE_APP_ID} />

          <QRTile label="Venmo"    url={venmoUrl}   color="#3d95ce" unconfigured={!VENMO_USER} />
          <QRTile label="Cash App" url={cashAppUrl} color="#00d64f" unconfigured={!CASHAPP_TAG} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 14 }}>
          <button onClick={onCancel} style={{
            ...baseButton, flex: 1, background: 'transparent',
            border: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 18,
          }}>
            Cancel
          </button>
          <button onClick={onPaid} style={{
            ...baseButton, flex: 3, background: theme.copper,
            color: '#1a1a1a', fontSize: 24, padding: '22px',
          }}>
            ✓ Paid
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────

export default function App() {
  const [entrants, setEntrants] = useState([]);
  const [winners, setWinners] = useState([]);
  const [stats, setStats] = useState({ total: 0, totalEntries: 0, newsletter: 0, hookCrook: 0, thiefcatcher: 0, bothBooks: 0, winnersCount: 0 });
  const [view, setView] = useState('main');
  const [confirmedEntrant, setConfirmedEntrant] = useState(null);

  // Manual entry form
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [formNewsletter, setFormNewsletter] = useState(false);
  const [formPurchase, setFormPurchase] = useState('none');
  const [formQty, setFormQty] = useState(1);
  const [showPayment, setShowPayment] = useState(false);


  // Other UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [drawnWinner, setDrawnWinner] = useState(null);
  const [drawnPrizeTier, setDrawnPrizeTier] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const nameRef = useRef(null);
  const [activeInput, setActiveInput] = useState(null);
  const [keyboardLayout, setKeyboardLayout] = useState('default');
  const keyboardRef = useRef(null);
  const [vkEnabled, setVkEnabled] = useState(() => localStorage.getItem('vkEnabled') !== 'false');
  const [showPin, setShowPin] = useState(false);


  // ── Data loading ────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const [ents, wins, st] = await Promise.all([api('/entrants'), api('/winners'), api('/stats')]);
      setEntrants(ents);
      setWinners(wins);
      setStats(st);
      setLoaded(true);
    } catch (e) {
      setError('Failed to load data — is the server running?');
      setLoaded(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);


  // ── Auto-dismiss confirmation screen ────────────────────────────

  useEffect(() => {
    if (view !== 'confirm') return;
    const t = setTimeout(() => { setView('main'); setConfirmedEntrant(null); }, 8000);
    return () => clearTimeout(t);
  }, [view]);

  // ── Entrant management ──────────────────────────────────────────

  const validateForm = useCallback(() => {
    if (!formData.name.trim()) return 'Name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) return 'Invalid email address';
    if (formData.phone.trim() && formData.phone.replace(/\D/g, '').length < 7) return 'Phone number looks too short';
    if (!formNewsletter && formPurchase === 'none') return 'Select at least newsletter signup or a purchase';
    return null;
  }, [formData, formNewsletter, formPurchase]);

  const requestPayment = useCallback(() => {
    const err = validateForm();
    if (err) { setError(err); return; }
    setActiveInput(null);
    setShowPayment(true);
  }, [validateForm]);

  const addEntrant = useCallback(async () => {
    try {
      const entrant = await api('/entrants', {
        method: 'POST',
        body: { name: formData.name.trim(), email: formData.email.trim(), phone: formData.phone.trim(), newsletter: formNewsletter, purchase: formPurchase, qty: formPurchase === 'none' ? 1 : formQty },
      });
      setFormData({ name: '', email: '', phone: '' });
      setFormNewsletter(false);
      setFormPurchase('none');
      setFormQty(1);
      setShowPayment(false);
      setError(null);
      setConfirmedEntrant(entrant);
      await refresh();
      setView('confirm');
    } catch (e) {
      setShowPayment(false);
      setError(e.message);
    }
  }, [formData, formNewsletter, formPurchase, formQty, refresh]);

  const updateEntrant = useCallback(async (id, changes) => {
    try {
      await api(`/entrants/${id}`, { method: 'PATCH', body: changes });
      setUpgradeTarget(null);
      await refresh();
    } catch (e) { setError(e.message); }
  }, [refresh]);

  const deleteEntrant = useCallback(async (id) => {
    try {
      await api(`/entrants/${id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      await refresh();
    } catch (e) { setError(e.message); }
  }, [refresh]);

  // ── Raffle draw ─────────────────────────────────────────────────

  const drawWinner = useCallback(async () => {
    const tier = prizeTierForDraw(winners.length);
    setIsDrawing(true);
    setDrawnWinner(null);
    setDrawnPrizeTier(tier);
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const winner = await api('/draw', { method: 'POST' });
      setDrawnWinner(winner);
      await refresh();
      setIsDrawing(false);
      setView('winner');
    } catch (e) {
      setError(e.message);
      setIsDrawing(false);
    }
  }, [refresh, winners.length]);

  const undoLastWinner = useCallback(async () => {
    try {
      await api('/winners/last', { method: 'DELETE' });
      await refresh();
      setView('draw');
    } catch (e) { setError(e.message); }
  }, [refresh]);

  const exportCSV = useCallback(() => { window.open('/api/export', '_blank'); }, []);
  const exportNewsletter = useCallback(() => { window.open('/api/export/newsletter', '_blank'); }, []);

  // ── Virtual keyboard ────────────────────────────────────────────

  const onKeyboardChange = useCallback((val) => {
    if (!activeInput) return;
    if (activeInput === 'search') {
      setSearchQuery(val);
    } else {
      setFormData((prev) => ({ ...prev, [activeInput]: val }));
    }
  }, [activeInput]);

  const onKeyPress = useCallback((button) => {
    if (button === '{shift}' || button === '{lock}') {
      setKeyboardLayout((prev) => (prev === 'default' ? 'shift' : 'default'));
    }
  }, []);

  const focusInput = useCallback((name, currentVal) => {
    if (!vkEnabled) return;
    setActiveInput(name);
    setKeyboardLayout('default');
    setTimeout(() => {
      keyboardRef.current?.setInput(currentVal ?? '', name);
      document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, [vkEnabled]);

  const toggleVK = useCallback(() => {
    setVkEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('vkEnabled', next);
      if (!next) setActiveInput(null);
      return next;
    });
  }, []);

  // ── Filtering ───────────────────────────────────────────────────

  const filteredEntrants = entrants.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.phone.includes(q);
  });

  const goHome = () => { setView('main'); setError(null); };

  if (!loaded) {
    return (
      <div style={{ background: theme.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.copper, fontFamily: "'Courier Prime', monospace", fontSize: 18 }}>
        Loading the ledger...
      </div>
    );
  }

  return (
    <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, fontFamily: "'Courier Prime', monospace", position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `radial-gradient(circle at 50% 0%, ${theme.copperDark}11 0%, transparent 60%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 48px', position: 'relative', zIndex: 1, paddingBottom: (activeInput && vkEnabled) ? 360 : 48 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ cursor: 'pointer', textAlign: 'left' }} onClick={goHome}>
            <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, color: theme.copper, letterSpacing: '0.05em', fontFamily: "'Playfair Display', Georgia, serif" }}>
              The Fence's Ledger
            </h1>
            <div style={{ width: 80, height: 2, background: `linear-gradient(90deg, ${theme.copper}, transparent)`, margin: '6px 0 0' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 12, color: theme.textMuted, letterSpacing: '0.25em', textTransform: 'uppercase' }}>
              Chymist Press × GalaxyCon 2026
            </div>
            {view !== 'admin' ? (
              <button onClick={() => setShowPin(true)} title="Staff access" style={{ background: 'none', border: 'none', color: theme.border, cursor: 'pointer', fontSize: 22, padding: 4, lineHeight: 1, transition: 'color 0.2s' }}>
                ⚙
              </button>
            ) : (
              <div style={{ width: 32 }} />
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: `${theme.danger}33`, border: `1px solid ${theme.danger}`, borderRadius: 4, padding: '10px 16px', marginBottom: 20, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => setError(null)}>✕</span>
          </div>
        )}

        {/* ── MAIN VIEW ──────────────────────────────────────────── */}
        {view === 'main' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32, alignItems: 'start' }}>

            {/* Left: stats + CTA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Entrants', value: stats.total },
                  { label: 'Entries', value: stats.totalEntries },
                  { label: 'Awarded', value: stats.winnersCount },
                ].map((s) => (
                  <div key={s.label} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, padding: '16px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, fontWeight: 700, color: theme.copperLight, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <button onClick={() => setView('add')} style={{ ...baseButton, width: '100%', background: theme.copper, color: '#1a1a1a', fontSize: 28, padding: '32px 24px', lineHeight: 1.2 }}>
                + Enter<br />the Raffle
              </button>
            </div>

            {/* Right: prizes */}
            <div>
              <div style={{ fontSize: 12, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>What you could win</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                {PRIZES.map((p) => (
                  <PrizeCard key={p.tier} prize={p} won={winners.filter((_, i) => prizeTierForWinner(i)?.tier === p.tier).length} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM VIEW ───────────────────────────────────────── */}
        {view === 'confirm' && confirmedEntrant && (
          <div
            style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', minHeight: '70vh' }}
            onClick={() => { setView('main'); setConfirmedEntrant(null); }}
          >
            <style>{`
              @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes drain { from { width: 100%; } to { width: 0%; } }
            `}</style>

            {/* Left: name + entries */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20, animation: 'fadeInUp 0.4s ease-out' }}>
                You're in the raffle!
              </div>
              <div style={{ fontSize: 72, fontWeight: 700, color: theme.gold, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.1, marginBottom: 20, animation: 'fadeInUp 0.7s ease-out', textShadow: `0 0 60px ${theme.gold}55` }}>
                {confirmedEntrant.name}
              </div>
              <div style={{ fontSize: 28, color: theme.copperLight, marginBottom: 48, animation: 'fadeInUp 1s ease-out' }}>
                {confirmedEntrant.entries} raffle {confirmedEntrant.entries === 1 ? 'entry' : 'entries'}
              </div>
              <div style={{ animation: 'fadeInUp 1.4s ease-out' }}>
                <div style={{ height: 4, background: theme.border, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', background: theme.copper, borderRadius: 2, animation: 'drain 8s linear forwards' }} />
                </div>
                <div style={{ fontSize: 13, color: theme.textMuted }}>Tap anywhere to dismiss</div>
              </div>
            </div>

            {/* Right: prizes */}
            <div style={{ animation: 'fadeInUp 1.2s ease-out' }}>
              <div style={{ fontSize: 12, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 16 }}>You could win</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                {PRIZES.map((p) => (
                  <PrizeCard key={p.tier} prize={p} won={winners.filter((_, i) => prizeTierForWinner(i)?.tier === p.tier).length} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ADD ENTRY VIEW ──────────────────────────────────────── */}
        {view === 'add' && (
          <div>
            <button onClick={goHome} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 14, fontFamily: "'Courier Prime', monospace", padding: '0 0 16px' }}>
              ← Back
            </button>

            {/* Row 1: 4 tiles side by side */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <SelectionTile
                label="By Hook & Crook"
                sublabel="$15 · +2 entries"
                image="/books/hook-crook.jpg"
                icon="📕"
                selected={formPurchase === 'hook_crook'}
                qty={formQty}
                onQtyChange={setFormQty}
                onClick={() => { setFormPurchase(formPurchase === 'hook_crook' ? 'none' : 'hook_crook'); setFormQty(1); }}
              />
              <SelectionTile
                label="Thiefcatcher"
                sublabel="$17 · +2 entries"
                image="/books/thiefcatcher.jpg"
                icon="📗"
                selected={formPurchase === 'thiefcatcher'}
                qty={formQty}
                onQtyChange={setFormQty}
                onClick={() => { setFormPurchase(formPurchase === 'thiefcatcher' ? 'none' : 'thiefcatcher'); setFormQty(1); }}
              />
              <SelectionTile
                label="Both Books"
                sublabel="$30 · +5 entries"
                image="/books/bundle.jpg"
                icon="📚"
                selected={formPurchase === 'both_books'}
                qty={formQty}
                onQtyChange={setFormQty}
                onClick={() => { setFormPurchase(formPurchase === 'both_books' ? 'none' : 'both_books'); setFormQty(1); }}
              />
              <SelectionTile
                label="Newsletter Only"
                sublabel="Free · +1 entry"
                icon="📜"
                selected={formNewsletter && formPurchase === 'none'}
                onClick={() => {
                  if (formPurchase !== 'none') {
                    setFormPurchase('none');
                    setFormQty(1);
                    setFormNewsletter(true);
                  } else {
                    setFormNewsletter(!formNewsletter);
                  }
                }}
              />
            </div>

            {/* Newsletter add-on when a book is selected */}
            {formPurchase !== 'none' && (
              <button
                onClick={() => setFormNewsletter(!formNewsletter)}
                style={{
                  width: '100%', padding: '12px 16px', marginBottom: 14,
                  background: formNewsletter ? `${theme.copper}22` : theme.surface,
                  border: `2px solid ${formNewsletter ? theme.copper : theme.border}`,
                  borderRadius: 6, color: formNewsletter ? theme.copperLight : theme.text,
                  cursor: 'pointer', fontFamily: "'Courier Prime', monospace", fontSize: 15,
                  textAlign: 'center', transition: 'all 0.15s',
                }}
              >
                📜 Also sign up for the newsletter {formNewsletter ? '✓' : ''} <span style={{ fontSize: 12, color: theme.textMuted }}>(+1 entry)</span>
              </button>
            )}

            {/* Entry count */}
            {(formNewsletter || formPurchase !== 'none') && (
              <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 20, color: theme.gold, fontWeight: 700 }}>
                = {calcEntries(formNewsletter, formPurchase, formQty)} raffle {calcEntries(formNewsletter, formPurchase, formQty) === 1 ? 'entry' : 'entries'}
              </div>
            )}

            {/* Row 2: form fields + submit in one horizontal line */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <input ref={nameRef} type="text" placeholder="Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} onFocus={() => focusInput('name', formData.name)} onKeyDown={(e) => e.key === 'Enter' && requestPayment()} style={{ ...baseInput, flex: 2 }} autoFocus />
              <input type="email" placeholder="Email *" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} onFocus={() => focusInput('email', formData.email)} onKeyDown={(e) => e.key === 'Enter' && requestPayment()} style={{ ...baseInput, flex: 2 }} />
              <input type="tel" placeholder="Phone (optional)" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} onFocus={() => focusInput('phone', formData.phone)} onKeyDown={(e) => e.key === 'Enter' && requestPayment()} style={{ ...baseInput, flex: 1.5 }} />
              <button onClick={requestPayment} disabled={!formData.name.trim() || !formData.email.trim() || (!formNewsletter && formPurchase === 'none')} style={{
                ...baseButton, flex: 1, whiteSpace: 'nowrap',
                background: (!formData.name.trim() || !formData.email.trim() || (!formNewsletter && formPurchase === 'none')) ? theme.border : theme.copper,
                color: (!formData.name.trim() || !formData.email.trim() || (!formNewsletter && formPurchase === 'none')) ? theme.textMuted : '#1a1a1a',
                fontSize: 20,
              }}>
                Record Entry
              </button>
            </div>
          </div>
        )}

        {/* ── ADMIN VIEW ─────────────────────────────────────────── */}
        {view === 'admin' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 40, alignItems: 'start' }}>

            {/* Left: actions */}
            <div>
              <h2 style={{ fontSize: 22, color: theme.copperLight, margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }}>
                Staff Access
              </h2>

              <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, padding: '14px 16px', marginBottom: 20, fontSize: 14, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span>📜 {stats.newsletter} newsletter</span>
                <span style={{ color: theme.border }}>│</span>
                <span>📕 {stats.hookCrook} H&amp;C</span>
                <span style={{ color: theme.border }}>│</span>
                <span>📗 {stats.thiefcatcher} TC</span>
                <span style={{ color: theme.border }}>│</span>
                <span>📚 {stats.bothBooks} bundle</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => setView('add')} style={{ ...baseButton, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.text }}>
                  Manual Entry
                </button>
                <button onClick={() => setView('list')} style={{ ...baseButton, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.text }}>
                  View Ledger ({stats.total})
                </button>
                <button onClick={() => setView('draw')} style={{ ...baseButton, background: 'transparent', border: `1px solid ${theme.gold}55`, color: theme.gold }}>
                  Draw Winner
                </button>
                <button onClick={exportCSV} style={{ ...baseButton, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 13 }}>
                  Export All (CSV)
                </button>
                <button onClick={exportNewsletter} style={{ ...baseButton, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 13 }}>
                  Export Newsletter ({stats.newsletter})
                </button>
                <button onClick={toggleVK} style={{ ...baseButton, background: vkEnabled ? `${theme.copper}22` : 'transparent', border: `1px solid ${vkEnabled ? theme.copper : theme.border}`, color: vkEnabled ? theme.copperLight : theme.textMuted, fontSize: 13 }}>
                  ⌨ Virtual Keyboard {vkEnabled ? 'On' : 'Off'}
                </button>
                <button onClick={goHome} style={{ ...baseButton, background: 'none', border: 'none', color: theme.textMuted, fontSize: 13, textAlign: 'left', padding: '8px 0' }}>
                  ← Back to Kiosk
                </button>
              </div>
            </div>

            {/* Right: recent entries */}
            <div>
              <div style={{ fontSize: 12, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>Recent entries</div>
              {entrants.length === 0 && <div style={{ color: theme.textMuted, fontSize: 14 }}>No entries yet.</div>}
              {entrants.slice(0, 8).map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${theme.border}44`, fontSize: 15 }}>
                  <span>{entrantSummary(e)} {e.name}</span>
                  <Badge>{e.entries} {e.entries === 1 ? 'entry' : 'entries'}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LIST VIEW ──────────────────────────────────────────── */}
        {view === 'list' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
              <button onClick={() => setView('admin')} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 14, fontFamily: "'Courier Prime', monospace", padding: 0 }}>
                ← Back
              </button>
              <h2 style={{ fontSize: 22, color: theme.copperLight, margin: 0, fontFamily: "'Playfair Display', Georgia, serif" }}>The Ledger</h2>
            </div>

            <input type="text" placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => focusInput('search', searchQuery)} style={{ ...baseInput, marginBottom: 16 }} />

            {filteredEntrants.length === 0 && (
              <div style={{ textAlign: 'center', color: theme.textMuted, padding: 40 }}>
                {entrants.length === 0 ? "The ledger is empty. No marks yet." : 'No matches found.'}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {filteredEntrants.map((e) => (
                <div key={e.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>
                        {e.name}
                        {e.is_winner ? <span style={{ marginLeft: 8, color: theme.gold, fontSize: 12 }}>★ WINNER</span> : null}
                      </div>
                      <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>
                        {entrantSummary(e)}
                        {(e.email || e.phone) && ' · '}
                        {e.email && <span>{e.email}</span>}
                        {e.email && e.phone && <span> · </span>}
                        {e.phone && <span>{e.phone}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                      <Badge>{e.entries}×</Badge>
                      <button onClick={() => upgradeTarget === e.id ? setUpgradeTarget(null) : setUpgradeTarget(e.id)} style={{ background: 'none', border: `1px solid ${theme.border}`, color: theme.textMuted, cursor: 'pointer', borderRadius: 3, padding: '4px 10px', fontSize: 14, fontFamily: "'Courier Prime', monospace" }}>↑</button>
                      <button onClick={() => setConfirmDelete(e.id)} style={{ background: 'none', border: `1px solid ${theme.border}`, color: theme.danger, cursor: 'pointer', borderRadius: 3, padding: '4px 10px', fontSize: 14, fontFamily: "'Courier Prime', monospace" }}>✕</button>
                    </div>
                  </div>

                  {upgradeTarget === e.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.border}`, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: theme.textMuted, width: '100%', marginBottom: 4 }}>Update entry:</span>
                      <button onClick={() => updateEntrant(e.id, { newsletter: !e.newsletter })} style={{ ...baseButton, padding: '6px 12px', fontSize: 12, background: e.newsletter ? `${theme.copper}33` : theme.surfaceHover, color: theme.text, border: `1px solid ${e.newsletter ? theme.copper : theme.border}` }}>
                        📜 Newsletter {e.newsletter ? '✓' : ''}
                      </button>
                      {Object.entries(PURCHASE_LEVELS).map(([key, val]) => (
                        <button key={key} onClick={() => updateEntrant(e.id, { purchase: key })} style={{ ...baseButton, padding: '6px 12px', fontSize: 12, background: e.purchase === key ? `${theme.copper}33` : theme.surfaceHover, color: theme.text, border: `1px solid ${e.purchase === key ? theme.copper : theme.border}` }}>
                          {val.icon} {val.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {confirmDelete === e.id && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.danger}55`, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: theme.danger }}>Remove this entry?</span>
                      <button onClick={() => deleteEntrant(e.id)} style={{ ...baseButton, padding: '6px 16px', fontSize: 12, background: theme.danger, color: '#fff' }}>Yes</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ ...baseButton, padding: '6px 16px', fontSize: 12, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted }}>No</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DRAW VIEW ──────────────────────────────────────────── */}
        {view === 'draw' && (() => {
          const nextTier = prizeTierForDraw(winners.length);
          const allPrizesDrawn = !nextTier;
          const canDraw = stats.total > 0 && stats.total > stats.winnersCount && !allPrizesDrawn;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>

              {/* Left: draw controls */}
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => setView('admin')} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 14, fontFamily: "'Courier Prime', monospace", padding: '0 0 20px', display: 'block', textAlign: 'left' }}>
                  ← Back
                </button>

                <h2 style={{ fontSize: 28, color: theme.gold, margin: '0 0 8px', fontFamily: "'Playfair Display', Georgia, serif" }}>The Drawing</h2>
                <div style={{ color: theme.textMuted, fontSize: 15, marginBottom: 28 }}>{stats.total - stats.winnersCount} eligible entrants</div>

                {nextTier && !isDrawing && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>Drawing for</div>
                    <div style={{ maxWidth: 220, margin: '0 auto' }}>
                      <PrizeCard prize={nextTier} won={winners.filter((_, i) => prizeTierForWinner(i)?.tier === nextTier.tier).length} highlight />
                    </div>
                  </div>
                )}

                {isDrawing ? (
                  <div style={{ padding: 40, fontSize: 22, color: theme.copper }}>
                    <style>{`@keyframes pulse { from { opacity: 0.4; } to { opacity: 1; } }`}</style>
                    <span style={{ animation: 'pulse 0.6s ease-in-out infinite alternate', display: 'inline-block' }}>Consulting the ledger...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {allPrizesDrawn ? (
                      <div style={{ color: theme.gold, fontSize: 18, padding: 20 }}>All prizes have been awarded.</div>
                    ) : (
                      <button onClick={drawWinner} disabled={!canDraw} style={{ ...baseButton, background: !canDraw ? theme.border : theme.gold, color: !canDraw ? theme.textMuted : '#1a1a1a', fontSize: 22, padding: '24px 32px' }}>
                        Draw {nextTier?.label}
                      </button>
                    )}
                    {winners.length > 0 && (
                      <button onClick={undoLastWinner} style={{ ...baseButton, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textMuted, fontSize: 13 }}>
                        Undo Last Draw
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right: winners list */}
              {winners.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>Previous Winners</div>
                  <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, padding: '8px 16px' }}>
                    {winners.map((w, i) => {
                      const tier = prizeTierForWinner(i);
                      return (
                        <div key={w.winner_id} style={{ fontSize: 15, padding: '8px 0', display: 'flex', gap: 10, alignItems: 'baseline', borderBottom: i < winners.length - 1 ? `1px solid ${theme.border}44` : 'none' }}>
                          <span style={{ color: theme.textMuted, minWidth: 24 }}>{i + 1}.</span>
                          <span style={{ color: theme.gold, flex: 1 }}>{w.name}</span>
                          <span style={{ color: theme.copper, fontSize: 12 }}>{tier?.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── WINNER REVEAL ──────────────────────────────────────── */}
        {view === 'winner' && drawnWinner && (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            <div style={{ fontSize: 16, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 20, animation: 'fadeIn 0.5s ease-out' }}>The Fence has chosen</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 48, alignItems: 'center', marginBottom: 40 }}>
              <div style={{ textAlign: 'right', animation: 'fadeIn 0.8s ease-out' }}>
                <div style={{ fontSize: 56, fontWeight: 700, color: theme.gold, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.1, textShadow: `0 0 40px ${theme.gold}44` }}>
                  {drawnWinner.name}
                </div>
                <div style={{ fontSize: 15, color: theme.textMuted, marginTop: 10 }}>
                  {drawnWinner.email && <div>{drawnWinner.email}</div>}
                  {drawnWinner.phone && <div>{drawnWinner.phone}</div>}
                </div>
                <div style={{ marginTop: 12 }}>
                  <Badge color={theme.gold}>{entrantSummary(drawnWinner)} · {drawnWinner.entries} {drawnWinner.entries === 1 ? 'entry' : 'entries'}</Badge>
                </div>
              </div>

              <div style={{ width: 2, height: 120, background: `linear-gradient(to bottom, transparent, ${theme.gold}55, transparent)` }} />

              {drawnPrizeTier && (
                <div style={{ animation: 'fadeIn 1.2s ease-out' }}>
                  <div style={{ fontSize: 11, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>Prize</div>
                  <div style={{ maxWidth: 240 }}>
                    <PrizeCard prize={drawnPrizeTier} highlight />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', animation: 'fadeIn 1.6s ease-out' }}>
              <button onClick={() => setView('draw')} style={{ ...baseButton, background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, fontSize: 16, padding: '16px 32px' }}>Draw Another</button>
              <button onClick={goHome} style={{ ...baseButton, background: theme.copper, color: '#1a1a1a', fontSize: 16, padding: '16px 32px' }}>Back to Ledger</button>
            </div>
          </div>
        )}

      </div>

      {/* ── PIN MODAL ──────────────────────────────────────────── */}
      {showPin && (
        <PinModal
          onSuccess={() => { setShowPin(false); setView('admin'); setError(null); }}
          onCancel={() => setShowPin(false)}
        />
      )}

      {/* ── PAYMENT MODAL ──────────────────────────────────────── */}
      {showPayment && (
        <PaymentModal
          purchase={formPurchase}
          qty={formQty}
          onPaid={addEntrant}
          onCancel={() => setShowPayment(false)}
        />
      )}

      {/* ── VIRTUAL KEYBOARD ───────────────────────────────────── */}
      {activeInput && vkEnabled && (
        <>
          <style>{`
            .kb-fence .hg-theme-default {
              background: #1a1815;
              border-top: 1px solid #2e2a22;
              border-radius: 0;
              padding: 12px 16px 16px;
              font-family: 'Courier Prime', monospace;
            }
            .kb-fence .hg-button {
              background: #242018;
              border-bottom: 3px solid #1a1815;
              border-radius: 5px;
              color: #e8dcc8;
              font-family: 'Courier Prime', monospace;
              font-size: 17px;
              font-weight: 600;
              height: 52px;
              box-shadow: none;
            }
            .kb-fence .hg-button:active {
              background: #c87533;
              color: #1a1a1a;
              border-bottom-color: #8b5220;
              transform: translateY(1px);
            }
            .kb-fence .hg-button.hg-functionBtn {
              background: #2e2a22;
              color: #8a7e6e;
              font-size: 13px;
            }
            .kb-fence .hg-button.hg-functionBtn:active {
              background: #c87533;
              color: #1a1a1a;
            }
            .kb-fence .hg-button[data-skbtn="{space}"] {
              background: #2e2a22;
              flex-grow: 6;
            }
            .kb-fence .hg-button[data-skbtn="{bksp}"] {
              background: #3a2a1a;
              color: #c87533;
            }
            .kb-fence .hg-row {
              gap: 6px;
              margin-bottom: 6px;
            }
          `}</style>
          {/* Scrim: clicking outside keyboard dismisses it */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onMouseDown={() => setActiveInput(null)}
          />
          <div
            className="kb-fence"
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Keyboard
              keyboardRef={(r) => { keyboardRef.current = r; }}
              inputName={activeInput}
              layoutName={keyboardLayout}
              layout={{
                default: [
                  '1 2 3 4 5 6 7 8 9 0 - {bksp}',
                  'q w e r t y u i o p @ .',
                  'a s d f g h j k l \' _',
                  '{shift} z x c v b n m , ! ? {shift}',
                  '{space}',
                ],
                shift: [
                  '! @ # $ % ^ & * ( ) + {bksp}',
                  'Q W E R T Y U I O P @ .',
                  'A S D F G H J K L " _',
                  '{shift} Z X C V B N M , ! ? {shift}',
                  '{space}',
                ],
              }}
              display={{
                '{bksp}': '⌫',
                '{shift}': '⇧',
                '{space}': 'SPACE',
              }}
              onChange={onKeyboardChange}
              onKeyPress={onKeyPress}
            />
          </div>
        </>
      )}
    </div>
  );
}
