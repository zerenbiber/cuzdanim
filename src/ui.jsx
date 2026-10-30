import React, { useEffect, useState } from 'react';

const PATHS = {
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M18 6 6 18M6 6l12 12',
  card: 'M3 7h18v12H3zM3 11h18M7 15h4',
  bill: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  coins: 'M9 14a6 3 0 1 0 0-.01M3 11v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3M15 8.5c3.3 0 6 1.3 6 3s-2.7 3-6 3M21 11.5v3c0 1.7-2.7 3-6 3M9 5c3.3 0 6 1.3 6 3s-2.7 3-6 3-6-1.3-6-3 2.7-3 6-3z',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  handshake: 'M7 11l4-4 3 3 3-3 4 4-7 7zM3 11l4 0M17 11h4M10 14l2 2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
  check: 'M20 6 9 17l-5-5',
  chevL: 'M15 18l-6-6 6-6',
  chevR: 'M9 18l6-6-6-6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
  spark: 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4',
};

export function Icon({ name, size = 20, color = 'currentColor', width = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Header({ title, onBack, right }) {
  return (
    <div className="header">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Geri">
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      <div style={{ marginLeft: 'auto' }}>{right}</div>
    </div>
  );
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = '');
  }, []);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn small" onClick={onClose} aria-label="Kapat">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AmountInput({ value, onChange, autoFocus, big }) {
  return (
    <div className={big ? 'amount big' : 'amount'}>
      <span>₺</span>
      <input inputMode="decimal" placeholder="0" value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} />
    </div>
  );
}

export function Chips({ options, value, onChange, colors }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o} className={o === value ? 'chip on' : 'chip'} onClick={() => onChange(o)} style={o === value && colors?.[o] ? { background: colors[o], borderColor: colors[o] } : null}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="seg">
      {options.map(([k, label]) => (
        <button type="button" key={k} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Bar({ pct, color = 'var(--green)', height = 8, track = 'var(--track)' }) {
  return (
    <div className="bar" style={{ height, background: track }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, height }} />
    </div>
  );
}

export function Check({ checked, onChange, label }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

export function Toast({ text, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [text]);
  return <div className="toast">{text}</div>;
}

export function MonthPicker({ ym, setYm, label }) {
  return (
    <div className="month">
      <button className="icon-btn small" onClick={() => setYm(-1)} aria-label="Önceki ay">
        <Icon name="chevL" size={16} />
      </button>
      <span>{label}</span>
      <button className="icon-btn small" onClick={() => setYm(1)} aria-label="Sonraki ay">
        <Icon name="chevR" size={16} />
      </button>
    </div>
  );
}

// ---------- Hedef kavanozu (oyunlaştırılmış ilerleme) ----------
export function Jar({ pct, color = '#D9A520', size = 120, drop = 0 }) {
  const p = Math.max(0, Math.min(100, pct));
  const id = React.useId().replace(/:/g, '');
  const top = 30, bottom = 140;
  const level = bottom - ((bottom - top) * p) / 100;
  return (
    <div className="jar" style={{ width: size, height: size * 1.25 }}>
      <svg viewBox="0 0 120 150" width={size} height={size * 1.25} role="img" aria-label={`Yüzde ${Math.round(p)} dolu`}>
        <defs>
          <clipPath id={`c${id}`}>
            <path d="M28 30h64v8c10 6 16 16 16 30v58c0 9-7 14-16 14H28c-9 0-16-5-16-14V68c0-14 6-24 16-30z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#c${id})`}>
          <rect x="0" y="0" width="120" height="150" fill="#EEF0EA" />
          <g className="wave" style={{ transform: `translateY(${level}px)`, transition: 'transform 900ms cubic-bezier(.2,.8,.2,1)' }}>
            <path d="M-120 6 Q-105 0 -90 6 T-60 6 T-30 6 T0 6 T30 6 T60 6 T90 6 T120 6 T150 6 T180 6 T210 6 T240 6 V200 H-120 Z" fill={color} />
            <path className="wave2" d="M-120 9 Q-105 3 -90 9 T-60 9 T-30 9 T0 9 T30 9 T60 9 T90 9 T120 9 T150 9 T180 9 T210 9 T240 9 V200 H-120 Z" fill={color} opacity="0.55" />
          </g>
        </g>
        <path d="M28 30h64v8c10 6 16 16 16 30v58c0 9-7 14-16 14H28c-9 0-16-5-16-14V68c0-14 6-24 16-30z" fill="none" stroke="#B9BDB4" strokeWidth="3" />
        <rect x="24" y="20" width="72" height="12" rx="4" fill="#9EA39A" />
      </svg>
      {drop > 0 && <span key={drop} className="coin" />}
      <span className="jar-pct">%{Math.round(p)}</span>
    </div>
  );
}

export function Confetti({ text, onDone }) {
  const [pieces] = useState(() =>
    Array.from({ length: 48 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      dur: 1.6 + Math.random() * 1.2,
      color: ['#D9A520', '#0E4D40', '#B4361F', '#26386E', '#6B3FA0'][i % 5],
      rot: Math.random() * 360,
    }))
  );
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="confetti" onClick={onDone}>
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
      <div className="confetti-card">
        <Icon name="spark" size={32} color="#D9A520" />
        <strong>{text}</strong>
      </div>
    </div>
  );
}
