import React, { useEffect, useRef } from 'react';
import * as D from './data.js';

// Her varlık kumbarada bir "jeton" olarak görünür.
// Jeton sayısı miktara göre; çok fazlaysa bir jeton daha büyük miktarı temsil eder.
const TOKEN = {
  GRAM: { base: 1, unitWord: 'gr', label: 'külçe', cls: 'bar', text: '' },
  CEYREK: { base: 1, unitWord: 'adet', label: 'çeyrek', cls: 'ceyrek', text: 'Ç' },
  USD: { base: 100, unitWord: '$', label: 'banknot', cls: 'usd', text: '$' },
  EUR: { base: 100, unitWord: '€', label: 'banknot', cls: 'eur', text: '€' },
  TL: { base: 1000, unitWord: '₺', label: 'para', cls: 'tl', text: '₺' },
};
const ORDER = ['GRAM', 'CEYREK', 'USD', 'EUR', 'TL'];
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const MAX_PER_ASSET = 16;

export function tokenPlan(holdings) {
  const byAsset = Object.fromEntries(holdings.map((h) => [h.asset, h]));
  return ORDER.map((a) => {
    const h = byAsset[a];
    const t = TOKEN[a];
    if (!h) return { asset: a, has: false, count: 0, unit: t.base, ...t };
    const k = STEPS.find((k) => Math.ceil(h.qty / (t.base * k)) <= MAX_PER_ASSET) || 1000;
    const unit = t.base * k;
    return { asset: a, has: true, count: Math.max(1, Math.ceil(h.qty / unit - 1e-9)), unit, qty: h.qty, value: h.value, ...t };
  });
}

// Basit, tekrarlanabilir rastgelelik (her açılışta aynı yığın)
const rnd = (i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export function Vault({ holdings, total }) {
  const plan = tokenPlan(holdings);
  const tokens = plan.flatMap((p) => Array.from({ length: p.count }, (_, i) => ({ key: `${p.asset}-${i}`, ...p })));
  // Her jetonun düşüş gecikmesi ilk görüldüğünde bir kez belirlenir;
  // böylece sonraki yenilemeler animasyonu bozmaz, yalnızca yeni jetonlar düşer.
  const first = useRef(true);
  const delays = useRef({});
  useEffect(() => {
    first.current = false;
  });

  const COLS = 6;
  let fresh = 0;
  for (let i = 0; i < tokens.length; i++) {
    const k = tokens[i].key;
    if (!(k in delays.current)) delays.current[k] = first.current ? i * 45 : fresh++ * 140;
  }
  return (
    <div className="vault">
      <div className="vault-jar">
        <div className="vault-lid" />
        <div className="vault-slot" />
        <div className="vault-glass">
          {tokens.map((t, i) => {
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            const shift = row % 2 ? 0.5 : 0;
            const left = 6 + (Math.min(COLS - 1, col + shift) / (COLS - 1)) * 73 + (rnd(i) - 0.5) * 3;
            const bottom = 10 + row * 22 + rnd(i + 7) * 4;
            return (
              <span
                key={t.key}
                className={`tok ${t.cls} drop`}
                style={{ left: `${left}%`, bottom, '--r': `${(rnd(i + 3) - 0.5) * 30}deg`, animationDelay: `${delays.current[t.key]}ms` }}
              >
                {t.text}
              </span>
            );
          })}
          {!tokens.length && <div className="vault-empty">Kumbaran boş. İlk birikimini ekle, içine düşsün!</div>}
          <div className="vault-shine" />
        </div>
        <div className="vault-total">{D.tl(total, 0)}</div>
      </div>

      <div className="vault-legend">
        {plan.map((p) => (
          <div key={p.asset} className={p.has ? 'leg' : 'leg off'}>
            <span className="leg-ic">
              <span className={`tok mini ${p.cls}`}>{p.text}</span>
            </span>
            <span className="grow">
              <strong>{D.ASSETS[p.asset].name}</strong>
              <small>{p.has ? `1 ${p.label} = ${D.num(p.unit)} ${p.unitWord}` : 'Yok'}</small>
            </span>
            <span className="leg-val">
              {p.has ? (
                <>
                  <strong>
                    {D.num(p.qty, 3)} {D.ASSETS[p.asset].unit}
                  </strong>
                  <small>{D.tl(p.value, 0)}</small>
                </>
              ) : (
                <small>—</small>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
