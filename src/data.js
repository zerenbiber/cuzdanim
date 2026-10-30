// Veri katmanı: kayıt, hesaplamalar, kurlar, motivasyon mesajları.
// v1'de tüm veriler telefonun kendi hafızasında (localStorage) tutulur.

const KEY = 'cuzdanim-v1';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const pad = (n) => String(n).padStart(2, '0');
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const monthKey = (date = today()) => date.slice(0, 7);
export const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const monthName = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const shortDate = (iso) => {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`;
};
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export const tl = (n, digits = 2) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n || 0);
export const num = (n, digits = 2) =>
  new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(n || 0);

// "1.250,50" veya "1250.5" -> 1250.5
export const parseAmount = (s) => {
  if (typeof s === 'number') return s;
  let t = String(s || '').trim().replace(/\s|₺/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : 0;
};

export const INCOME_TYPES = ['Maaş', 'Burs', 'Harçlık', 'Ek iş', 'Diğer'];

export const ASSETS = {
  GRAM: { name: 'Gram altın', unit: 'gr', color: '#B7860B' },
  CEYREK: { name: 'Çeyrek altın', unit: 'adet', color: '#D4A017' },
  USD: { name: 'Dolar', unit: '$', color: '#26386E' },
  EUR: { name: 'Euro', unit: '€', color: '#0E6B58' },
  TL: { name: 'TL birikim', unit: '₺', color: '#5B6068' },
};

const defaultState = () => ({
  version: 1,
  startBalance: 0,
  onboarded: false,
  pinHash: null,
  categories: [
    { name: 'Market', limit: 0, color: '#0E4D40' },
    { name: 'Yeme-içme', limit: 0, color: '#B4361F' },
    { name: 'Ulaşım', limit: 0, color: '#26386E' },
    { name: 'Eğlence', limit: 0, color: '#8A5A0B' },
    { name: 'Giyim', limit: 0, color: '#6B3FA0' },
    { name: 'Eğitim', limit: 0, color: '#1D5670' },
    { name: 'Faturalar', limit: 0, color: '#A0522D' },
    { name: 'Ödemeler', limit: 0, color: '#3A2E5C' },
    { name: 'Diğer', limit: 0, color: '#5B6068' },
  ],
  transactions: [], // {id,date,type:'gelir'|'gider',amount,category,note,billId?}
  bills: [], // {id,kind:'fatura'|'odeme',name,amount,day,repeat:'aylik'|'tek',date?,paid:{ym:txId}}
  savings: [], // {id,date,asset,dir:'alim'|'satim',qty,price,affects}
  rates: { USD: 0, EUR: 0, GRAM: 0, CEYREK: 0, TL: 1, updatedAt: 0, manual: {} },
  goals: [], // {id,name,icon,target,deadline,created,done,contribs:[{id,date,amount,affects}]}
  debts: [], // {id,person,dir:'borcum'|'alacagim',due,note,created,moves:[{id,date,type,amount,note,affects}]}
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* hafıza dolu ya da kapalı */
  }
}

export const resetAll = () => defaultState();

// ---------- Hesaplamalar ----------

export function debtRemaining(d) {
  let r = 0;
  for (const m of d.moves) r += m.type === 'odeme' ? -m.amount : m.amount;
  return Math.max(0, r);
}
export function debtTotal(d) {
  return d.moves.filter((m) => m.type !== 'odeme').reduce((s, m) => s + m.amount, 0);
}

export function goalSaved(g) {
  return g.contribs.reduce((s, c) => s + c.amount, 0);
}

export function balance(s) {
  let b = Number(s.startBalance) || 0;
  for (const t of s.transactions) b += t.type === 'gelir' ? t.amount : -t.amount;
  for (const v of s.savings) if (v.affects) b += (v.dir === 'satim' ? 1 : -1) * v.qty * v.price;
  for (const g of s.goals) for (const c of g.contribs) if (c.affects) b -= c.amount;
  for (const d of s.debts)
    for (const m of d.moves) {
      if (!m.affects) continue;
      const sign = d.dir === 'borcum' ? (m.type === 'odeme' ? -1 : 1) : m.type === 'odeme' ? 1 : -1;
      b += sign * m.amount;
    }
  return b;
}

export function monthSpending(s, ym) {
  const byCat = {};
  let total = 0;
  for (const t of s.transactions) {
    if (t.type !== 'gider' || monthKey(t.date) !== ym) continue;
    byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    total += t.amount;
  }
  return { byCat, total };
}

export function monthIncome(s, ym) {
  return s.transactions.filter((t) => t.type === 'gelir' && monthKey(t.date) === ym).reduce((a, t) => a + t.amount, 0);
}

export const totalLimit = (s) => s.categories.reduce((a, c) => a + (Number(c.limit) || 0), 0);

export function rateOf(s, asset) {
  if (asset === 'TL') return 1;
  const m = s.rates.manual?.[asset];
  return m > 0 ? m : s.rates[asset] || 0;
}

// Ortalama maliyet yöntemiyle varlık özeti
export function holdings(s) {
  const out = {};
  const sorted = [...s.savings].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const v of sorted) {
    const h = (out[v.asset] ||= { asset: v.asset, qty: 0, cost: 0 });
    if (v.dir === 'alim') {
      h.qty += v.qty;
      h.cost += v.qty * v.price;
    } else {
      const avg = h.qty > 0 ? h.cost / h.qty : 0;
      const q = Math.min(v.qty, h.qty);
      h.qty -= q;
      h.cost -= avg * q;
    }
  }
  return Object.values(out)
    .filter((h) => h.qty > 1e-9)
    .map((h) => {
      const live = rateOf(s, h.asset);
      // Kur henüz alınamadıysa alış maliyetini göster (sahte zarar gösterme)
      const rate = live > 0 ? live : h.cost / h.qty;
      const value = h.qty * rate;
      return { ...h, rate, noRate: !(live > 0), value, pl: value - h.cost, plPct: h.cost > 0 ? ((value - h.cost) / h.cost) * 100 : 0 };
    });
}

export function billsForMonth(s, kind, ym) {
  return s.bills
    .filter((b) => b.kind === kind)
    .filter((b) => (b.repeat === 'aylik' ? true : monthKey(b.date) <= ym && !(b.paid && Object.keys(b.paid).some((k) => k < ym))))
    .map((b) => {
      const [y, m] = ym.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      const due = b.repeat === 'aylik' ? `${ym}-${pad(Math.min(b.day, last))}` : b.date;
      const paidTx = b.paid?.[ym];
      return { ...b, due, isPaid: !!paidTx, daysLeft: daysBetween(today(), due) };
    })
    .sort((a, b) => (a.due < b.due ? -1 : 1));
}

// ---------- Kurlar ----------
// Ücretsiz, anahtarsız kur kaynağı (günlük güncellenir). Gram altın ons fiyatından hesaplanır;
// kuyumcu fiyatı farklıysa uygulamada elle düzeltilebilir.
const RATE_URLS = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/try.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/try.min.json',
];
const OUNCE_GRAMS = 31.1034768;
const CEYREK_FACTOR = 1.6065; // çeyrek ≈ 1,75 g x 22 ayar ≈ 1,6065 g has altın

export async function fetchRates() {
  for (const url of RATE_URLS) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const j = await res.json();
      const t = j.try;
      const gram = 1 / t.xau / OUNCE_GRAMS;
      return { USD: 1 / t.usd, EUR: 1 / t.eur, GRAM: gram, CEYREK: gram * CEYREK_FACTOR, TL: 1, date: j.date, updatedAt: Date.now() };
    } catch {
      /* sıradaki kaynağı dene */
    }
  }
  throw new Error('Kurlar alınamadı. İnternet bağlantını kontrol et.');
}

// ---------- PIN ----------
export async function hashPin(pin) {
  const data = new TextEncoder().encode('cuzdanim:' + pin);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (const b of data) h = (h * 31 + b) >>> 0;
  return 'h' + h.toString(16);
}

// ---------- Motivasyon ----------
const GENERAL = [
  'Küçük birikimler büyük hedeflere dönüşür. Bugün de bir adım at.',
  'Harcamanı yazmak, kontrolü eline almanın ilk adımı.',
  'Bugün gereksiz bir harcamadan vazgeçmek, yarınki hedefine yatırım.',
  'Bütçe kısıtlama değil, paranın sana çalışmasıdır.',
  'Her lira bir görev alırsa, sonunda hepsi senin için çalışır.',
  'Düzenli olmak, çok kazanmaktan daha güçlüdür.',
  'Bugün kendine şunu sor: Buna gerçekten ihtiyacım var mı?',
  'Hedefine her gün biraz daha yaklaşıyorsun. Devam!',
];

export function dailyMessage(s) {
  const dayIndex = Math.floor(Date.parse(today()) / 864e5);
  const ideas = [];

  for (const g of s.goals.filter((x) => !x.done)) {
    const saved = goalSaved(g);
    const pct = g.target > 0 ? Math.min(100, (saved / g.target) * 100) : 0;
    const left = g.target - saved;
    if (left <= 0) continue;
    if (g.deadline) {
      const days = daysBetween(today(), g.deadline);
      if (days > 0) {
        ideas.push(`${g.name} hedefine %${Math.round(pct)} yaklaştın. Günde ${tl(left / days, 0)} ile ${days} günde ulaşırsın.`);
        continue;
      }
    }
    ideas.push(`${g.name} hedefinde %${Math.round(pct)} tamam. Kalan ${tl(left, 0)}, sen yaparsın!`);
  }

  const ym = monthKey();
  const lim = totalLimit(s);
  if (lim > 0) {
    const spent = monthSpending(s, ym).total;
    const [y, m] = ym.split('-').map(Number);
    const daysLeft = new Date(y, m, 0).getDate() - new Date().getDate() + 1;
    if (spent < lim) ideas.push(`Bu ay bütçende ${tl(lim - spent, 0)} kaldı. Günde ${tl((lim - spent) / daysLeft, 0)} harcayabilirsin.`);
    else ideas.push(`Bu ay bütçeni ${tl(spent - lim, 0)} aştın. Ay sonuna kadar biraz frene basalım.`);
  }

  const open = s.debts.filter((d) => d.dir === 'borcum' && debtRemaining(d) > 0);
  if (open.length) {
    const total = open.reduce((a, d) => a + debtRemaining(d), 0);
    ideas.push(`Toplam ${tl(total, 0)} borcun kaldı. Her ödeme seni özgürlüğe yaklaştırıyor.`);
  }

  const pool = ideas.length ? (dayIndex % 3 === 2 ? GENERAL : ideas) : GENERAL;
  return pool[dayIndex % pool.length];
}

// ---------- Yedek / dışa aktarma ----------
export function exportCsv(s) {
  const rows = [['Tarih', 'Tür', 'Kategori', 'Tutar (TL)', 'Açıklama']];
  for (const t of [...s.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)))
    rows.push([t.date, t.type, t.category, String(t.amount).replace('.', ','), (t.note || '').replace(/;/g, ',')]);
  return '﻿' + rows.map((r) => r.join(';')).join('\n');
}

export function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
