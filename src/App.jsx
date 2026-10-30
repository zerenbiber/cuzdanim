import React, { useEffect, useMemo, useState } from 'react';
import * as D from './data.js';
import { Vault } from './vault.jsx';
import * as P from './push.js';
import { Icon, Header, Sheet, Field, AmountInput, Chips, Segmented, Bar, Check, Empty, Toast, MonthPicker, Jar, Confetti } from './ui.jsx';

// ---------- Yönlendirme ----------
// Her alt sayfa ana ekrana döner. Uygulama kendi geçmiş kaydını tutar;
// Safari'nin geri hareketi (kaydırma) ve ekrandaki geri tuşu aynı sonucu verir.
const readRoute = () => window.location.hash.replace(/^#\/?/, '') || 'home';
const notify = () => window.dispatchEvent(new Event('routechange'));

const useRoute = () => {
  const [r, setR] = useState(readRoute);
  useEffect(() => {
    // İlk açılışta alt sayfadaysak altına ana ekranı koy ki geri gidilebilsin
    if (readRoute() !== 'home' && !history.state?.app) {
      const p = readRoute();
      history.replaceState({ app: true, p: 'home' }, '', location.pathname + location.search);
      history.pushState({ app: true, p }, '', '#/' + p);
    } else if (!history.state?.app) {
      history.replaceState({ app: true, p: 'home' }, '', location.pathname + location.search);
    }
    const f = () => setR(readRoute());
    window.addEventListener('popstate', f);
    window.addEventListener('hashchange', f);
    window.addEventListener('routechange', f);
    return () => {
      window.removeEventListener('popstate', f);
      window.removeEventListener('hashchange', f);
      window.removeEventListener('routechange', f);
    };
  }, []);
  return r;
};

const go = (p) => {
  if (p === readRoute()) return;
  if (p === 'home') history.replaceState({ app: true, p: 'home' }, '', location.pathname + location.search);
  else history.pushState({ app: true, p, sub: true }, '', '#/' + p);
  notify();
};

const back = () => {
  // Bir alt sayfaya bizim açtığımız kayıtla geldiysek geri git, değilse doğrudan ana ekrana dön
  if (history.state?.sub) history.back();
  else go('home');
};

export default function App() {
  const [s, setS] = useState(D.load);
  const [locked, setLocked] = useState(() => !!D.load().pinHash);
  const [toast, setToast] = useState(null);
  const [party, setParty] = useState(null);
  const route = useRoute();

  useEffect(() => {
    D.save(s);
  }, [s]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // fn taslağı değiştirir; yeni bir nesne döndürürse o kullanılır
  const update = (fn) =>
    setS((prev) => {
      const draft = structuredClone(prev);
      const r = fn(draft);
      return r && typeof r === 'object' ? r : draft;
    });
  const ctx = { s, update, notify: setToast, celebrate: setParty };

  // Kurları günde bir otomatik güncelle
  useEffect(() => {
    if (Date.now() - (s.rates.updatedAt || 0) < 6 * 3600e3) return;
    D.fetchRates()
      .then((r) => update((x) => void (x.rates = { ...x.rates, ...r })))
      .catch(() => {});
  }, []);

  // Bildirimler açıksa fatura/ödeme listesi değişince sunucuya bildir
  useEffect(() => {
    if (!s.pushOn) return;
    const t = setTimeout(() => P.syncBills(s.bills).catch(() => {}), 800);
    return () => clearTimeout(t);
  }, [s.bills, s.pushOn]);

  if (locked) return <Lock hash={s.pinHash} onOpen={() => setLocked(false)} />;
  if (!s.onboarded) return <Onboarding ctx={ctx} />;

  const screens = {
    home: Home,
    harcamalar: Spending,
    faturalar: (p) => <Bills {...p} kind="fatura" />,
    odemeler: (p) => <Bills {...p} kind="odeme" />,
    birikimler: Savings,
    hedefler: Goals,
    borclar: Debts,
    ayarlar: Settings,
  };
  const Screen = screens[route] || Home;

  return (
    <div className="app">
      <Screen ctx={ctx} />
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
      {party && <Confetti text={party} onDone={() => setParty(null)} />}
    </div>
  );
}

// ---------- Kilit ----------
function Lock({ hash, onOpen }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const press = async (k) => {
    const next = k === 'del' ? pin.slice(0, -1) : (pin + k).slice(0, 4);
    setPin(next);
    setErr(false);
    if (next.length === 4) {
      if ((await D.hashPin(next)) === hash) onOpen();
      else {
        setErr(true);
        setTimeout(() => setPin(''), 300);
      }
    }
  };
  return (
    <div className="app lock">
      <Icon name="lock" size={36} color="var(--green)" />
      <h2>PIN'ini gir</h2>
      <div className={err ? 'dots shake' : 'dots'}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button key={i} onClick={() => press(k)} aria-label={k === 'del' ? 'Sil' : k}>
              {k === 'del' ? <Icon name="back" /> : k}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ---------- İlk açılış ----------
function Onboarding({ ctx }) {
  const [bal, setBal] = useState('');
  return (
    <div className="app onboarding">
      <div className="ob-logo">
        <Icon name="card" size={36} color="#fff" />
      </div>
      <h1>Cüzdanım'a hoş geldin</h1>
      <p>Başlamak için bankadaki ve cebindeki toplam paranı yaz. Sonra her gelir ve gider bu bakiyeyi günceller.</p>
      <Field label="Başlangıç bakiyesi">
        <AmountInput value={bal} onChange={setBal} big autoFocus />
      </Field>
      <button
        className="btn primary"
        onClick={() =>
          ctx.update((x) => {
            x.startBalance = D.parseAmount(bal);
            x.onboarded = true;
          })
        }
      >
        Başla
      </button>
    </div>
  );
}

// ---------- Ana ekran ----------
const TILES = [
  { r: 'harcamalar', label: 'Harcamalarım', sub: 'Kategori ve limit', icon: 'chart', bg: '#E6EAF5', fg: '#26386E' },
  { r: 'faturalar', label: 'Faturalarım', sub: 'Elektrik, su, internet', icon: 'bill', bg: '#FCEFD9', fg: '#8A5A0B' },
  { r: 'odemeler', label: 'Ödemelerim', sub: 'Kira, abonelik', icon: 'card', bg: '#E4F0EC', fg: '#0E4D40' },
  { r: 'birikimler', label: 'Birikimlerim', sub: 'Altın, döviz, TL', icon: 'coins', bg: '#FBF1D3', fg: '#7A5A00' },
  { r: 'hedefler', label: 'Hedeflerim', sub: 'Kumbaram', icon: 'target', bg: '#EFE6F7', fg: '#5A2F8A' },
  { r: 'borclar', label: 'Borçlarım', sub: 'Borç ve alacak', icon: 'handshake', bg: '#F5E4E0', fg: '#8E2D1B' },
];

function Home({ ctx }) {
  const { s } = ctx;
  const [sheet, setSheet] = useState(null);
  const bal = D.balance(s);
  const ym = D.monthKey();
  const spent = D.monthSpending(s, ym).total;
  const lim = D.totalLimit(s);
  const msg = useMemo(() => D.dailyMessage(s), [s]);
  const recent = [...s.transactions].sort((a, b) => (a.date + a.id < b.date + b.id ? 1 : -1)).slice(0, 5);
  const pending = D.billsForMonth(s, 'fatura', ym).concat(D.billsForMonth(s, 'odeme', ym)).filter((b) => !b.isPaid && b.daysLeft <= 3);

  return (
    <>
      <div className="header">
        <div>
          <div className="muted small">{greeting()}</div>
          <div className="hello">Cüzdanım</div>
        </div>
        <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => go('ayarlar')} aria-label="Ayarlar">
          <Icon name="gear" />
        </button>
      </div>

      <div className="balance">
        <div className="row between">
          <span className="bal-label">Mevcut Bakiye</span>
          <span className="pill">{D.monthName(ym)}</span>
        </div>
        <div className={bal < 0 ? 'bal neg' : 'bal'}>{D.tl(bal)}</div>
        {lim > 0 ? (
          <div className="bal-budget">
            <div className="row between">
              <span>Aylık bütçe</span>
              <span>
                {D.tl(spent, 0)} / {D.tl(lim, 0)}
              </span>
            </div>
            <Bar pct={(spent / lim) * 100} color={spent > lim ? '#FF8A70' : '#F2C46D'} track="rgba(255,255,255,.22)" />
          </div>
        ) : (
          <button className="link-light" onClick={() => go('harcamalar')}>
            Aylık bütçe limiti belirle
          </button>
        )}
        <div className="row gap">
          <button className="btn white" onClick={() => setSheet('gelir')}>
            <Icon name="plus" size={18} /> Para Ekle
          </button>
          <button className="btn ghost-light" onClick={() => setSheet('gider')}>
            <Icon name="minus" size={18} /> Harcama
          </button>
        </div>
      </div>

      <div className="motivation">
        <Icon name="spark" size={18} color="#8A5A0B" />
        <span>{msg}</span>
      </div>

      {pending.length > 0 && (
        <button className="alert" onClick={() => go(pending[0].kind === 'fatura' ? 'faturalar' : 'odemeler')}>
          {pending.length} ödemenin son günü yaklaştı: {pending.map((b) => b.name).join(', ')}
        </button>
      )}

      <div className="tiles">
        {TILES.map((t) => (
          <button key={t.r} className="tile" onClick={() => go(t.r)}>
            <span className="tile-ic" style={{ background: t.bg }}>
              <Icon name={t.icon} size={22} color={t.fg} />
            </span>
            <span>
              <strong>{t.label}</strong>
              <small>{t.sub}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="section-head">
        <h3>Son işlemler</h3>
        <button className="link" onClick={() => go('harcamalar')}>
          Tümü
        </button>
      </div>
      {recent.length ? <TxList ctx={ctx} items={recent} /> : <Empty text="Henüz işlem yok. Para Ekle ya da Harcama ile başla." />}

      {sheet && <TxSheet ctx={ctx} type={sheet} onClose={() => setSheet(null)} />}
    </>
  );
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 6 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
};

function TxList({ ctx, items, deletable }) {
  const cat = Object.fromEntries(ctx.s.categories.map((c) => [c.name, c.color]));
  return (
    <div className="list">
      {items.map((t) => (
        <div className="item" key={t.id}>
          <span className="dot" style={{ background: t.type === 'gelir' ? 'var(--green)' : cat[t.category] || '#5B6068' }} />
          <span className="grow">
            <strong>{t.note || t.category}</strong>
            <small>
              {D.shortDate(t.date)} · {t.category}
            </small>
          </span>
          <span className={t.type === 'gelir' ? 'amt in' : 'amt out'}>
            {t.type === 'gelir' ? '+' : '−'}
            {D.tl(t.amount)}
          </span>
          {deletable && (
            <button
              className="icon-btn small ghost"
              aria-label="Sil"
              onClick={() => {
                if (!confirm('Bu işlem silinsin mi?')) return;
                ctx.update((x) => {
                  x.transactions = x.transactions.filter((y) => y.id !== t.id);
                  for (const b of x.bills) for (const k in b.paid || {}) if (b.paid[k] === t.id) delete b.paid[k];
                });
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// Gelir (Para Ekle) ve gider formu
function TxSheet({ ctx, type, onClose, presetCategory }) {
  const isIncome = type === 'gelir';
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(presetCategory || (isIncome ? D.INCOME_TYPES[0] : ctx.s.categories[0]?.name));
  const [date, setDate] = useState(D.today());
  const [note, setNote] = useState('');
  const quick = ['100', '250', '500', '1000'];
  const submit = () => {
    const v = D.parseAmount(amount);
    if (!(v > 0)) return ctx.notify('Tutar gir');
    ctx.update((x) => void x.transactions.push({ id: D.uid(), date, type, amount: v, category, note: note.trim() }));
    ctx.notify(isIncome ? 'Para eklendi' : 'Harcama kaydedildi');
    onClose();
  };
  return (
    <Sheet title={isIncome ? 'Para Ekle' : 'Harcama Ekle'} onClose={onClose}>
      <AmountInput value={amount} onChange={setAmount} big autoFocus />
      {isIncome && (
        <div className="quick">
          {quick.map((q) => (
            <button key={q} type="button" className={amount === q ? 'chip on' : 'chip'} onClick={() => setAmount(q)}>
              ₺{D.num(Number(q))}
            </button>
          ))}
        </div>
      )}
      <Field label={isIncome ? 'Gelir türü' : 'Kategori'}>
        <Chips
          options={isIncome ? D.INCOME_TYPES : ctx.s.categories.map((c) => c.name)}
          value={category}
          onChange={setCategory}
          colors={isIncome ? null : Object.fromEntries(ctx.s.categories.map((c) => [c.name, c.color]))}
        />
      </Field>
      <div className="row gap">
        <Field label="Tarih">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Açıklama">
          <input value={note} placeholder={isIncome ? 'Örn. Ekim maaşı' : 'Örn. Migros'} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <button className="btn primary" onClick={submit}>
        {isIncome ? 'Ekle' : 'Kaydet'}
      </button>
    </Sheet>
  );
}

// ---------- Harcamalarım ----------
function Spending({ ctx }) {
  const { s } = ctx;
  const [ym, setYm] = useState(D.monthKey());
  const [sheet, setSheet] = useState(null);
  const { byCat, total } = D.monthSpending(s, ym);
  const income = D.monthIncome(s, ym);
  const lim = D.totalLimit(s);
  const tx = s.transactions.filter((t) => D.monthKey(t.date) === ym).sort((a, b) => (a.date + a.id < b.date + b.id ? 1 : -1));
  const [y, m] = ym.split('-').map(Number);
  const daysLeft = ym === D.monthKey() ? new Date(y, m, 0).getDate() - new Date().getDate() + 1 : 0;
  const cats = [...s.categories].sort((a, b) => (byCat[b.name] || 0) - (byCat[a.name] || 0));

  return (
    <>
      <Header title="Harcamalarım" onBack={back} />
      <MonthPicker ym={ym} label={D.monthName(ym)} setYm={(d) => setYm(D.shiftMonth(ym, d))} />
      <div className="card">
        <div className="row between end">
          <div>
            <div className="muted small">Bu ay harcanan</div>
            <div className="big-num">{D.tl(total, 0)}</div>
          </div>
          <div className="right">
            <div className="muted small">Gelir</div>
            <div className="amt in">{D.tl(income, 0)}</div>
          </div>
        </div>
        {lim > 0 && (
          <>
            <Bar pct={(total / lim) * 100} color={total > lim ? 'var(--red)' : 'var(--green)'} height={10} />
            <div className={total > lim ? 'small red' : 'small green'}>
              {total > lim
                ? `Limiti ${D.tl(total - lim, 0)} aştın`
                : `${D.tl(lim - total, 0)} kaldı${daysLeft ? ` · günde ${D.tl((lim - total) / daysLeft, 0)} harcayabilirsin` : ''}`}
            </div>
          </>
        )}
      </div>

      <div className="section-head">
        <h3>Kategoriler</h3>
        <button className="link" onClick={() => setSheet('limits')}>
          Limit belirle
        </button>
      </div>
      <div className="card tight">
        {cats.map((c) => {
          const v = byCat[c.name] || 0;
          const pct = c.limit > 0 ? (v / c.limit) * 100 : 0;
          const warn = c.limit > 0 && pct >= 90;
          if (!v && !c.limit) return null;
          return (
            <div className="cat" key={c.name}>
              <div className="row gap center">
                <span className="dot" style={{ background: c.color }} />
                <strong className="grow">{c.name}</strong>
                <span className={warn ? 'small red' : 'small muted'}>
                  {D.tl(v, 0)}
                  {c.limit > 0 ? ` / ${D.tl(c.limit, 0)}` : ''}
                </span>
              </div>
              {c.limit > 0 && <Bar pct={pct} height={6} color={warn ? 'var(--red)' : c.color} />}
            </div>
          );
        })}
        {!total && !lim && <Empty text="Bu ay harcama yok." />}
      </div>

      <div className="section-head">
        <h3>İşlemler</h3>
      </div>
      {tx.length ? <TxList ctx={ctx} items={tx} deletable /> : <Empty text="Bu ay işlem yok." />}

      <div className="fab-space" />
      <button className="btn primary fab" onClick={() => setSheet('gider')}>
        <Icon name="plus" size={18} /> Harcama Ekle
      </button>

      {sheet === 'gider' && <TxSheet ctx={ctx} type="gider" onClose={() => setSheet(null)} />}
      {sheet === 'limits' && <LimitsSheet ctx={ctx} onClose={() => setSheet(null)} />}
    </>
  );
}

function LimitsSheet({ ctx, onClose }) {
  const [vals, setVals] = useState(() => Object.fromEntries(ctx.s.categories.map((c) => [c.name, c.limit ? String(c.limit) : ''])));
  const [newCat, setNewCat] = useState('');
  const total = Object.values(vals).reduce((a, v) => a + D.parseAmount(v), 0);
  return (
    <Sheet title="Aylık limitler" onClose={onClose}>
      <p className="muted small">Boş bırakılan kategoride limit olmaz. Toplam aylık bütçe: {D.tl(total, 0)}</p>
      {ctx.s.categories.map((c) => (
        <div className="row gap center limit-row" key={c.name}>
          <span className="dot" style={{ background: c.color }} />
          <span className="grow">{c.name}</span>
          <AmountInput value={vals[c.name]} onChange={(v) => setVals({ ...vals, [c.name]: v })} />
        </div>
      ))}
      <div className="row gap">
        <input className="grow" placeholder="Yeni kategori adı" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
        <button
          className="btn small"
          onClick={() => {
            const n = newCat.trim();
            if (!n || ctx.s.categories.some((c) => c.name === n)) return;
            ctx.update((x) => void x.categories.push({ name: n, limit: 0, color: '#' + ((Math.random() * 0x777777) | 0).toString(16).padStart(6, '0') }));
            setVals({ ...vals, [n]: '' });
            setNewCat('');
          }}
        >
          Ekle
        </button>
      </div>
      <button
        className="btn primary"
        onClick={() => {
          ctx.update((x) => x.categories.forEach((c) => (c.limit = D.parseAmount(vals[c.name]))));
          ctx.notify('Limitler kaydedildi');
          onClose();
        }}
      >
        Kaydet
      </button>
    </Sheet>
  );
}

// ---------- Faturalarım / Ödemelerim ----------
function Bills({ ctx, kind }) {
  const { s } = ctx;
  const [ym, setYm] = useState(D.monthKey());
  const [tab, setTab] = useState('bekleyen');
  const [sheet, setSheet] = useState(false);
  const isBill = kind === 'fatura';
  const all = D.billsForMonth(s, kind, ym);
  const list = all.filter((b) => (tab === 'bekleyen' ? !b.isPaid : b.isPaid));
  const unpaid = all.filter((b) => !b.isPaid);
  const sum = unpaid.reduce((a, b) => a + b.amount, 0);

  const pay = (b) =>
    ctx.update((x) => {
      const bill = x.bills.find((y) => y.id === b.id);
      const id = D.uid();
      x.transactions.push({ id, date: D.today(), type: 'gider', amount: b.amount, category: isBill ? 'Faturalar' : 'Ödemeler', note: b.name, billId: b.id });
      if (!x.categories.some((c) => c.name === (isBill ? 'Faturalar' : 'Ödemeler'))) x.categories.push({ name: isBill ? 'Faturalar' : 'Ödemeler', limit: 0, color: '#A0522D' });
      bill.paid = { ...(bill.paid || {}), [ym]: id };
    });
  const unpay = (b) =>
    ctx.update((x) => {
      const bill = x.bills.find((y) => y.id === b.id);
      const txId = bill.paid?.[ym];
      x.transactions = x.transactions.filter((t) => t.id !== txId);
      delete bill.paid[ym];
    });
  const remove = (b) => {
    if (!confirm(`${b.name} silinsin mi? Geçmiş ödemeler harcamalarda kalır.`)) return;
    ctx.update((x) => void (x.bills = x.bills.filter((y) => y.id !== b.id)));
  };

  return (
    <>
      <Header title={isBill ? 'Faturalarım' : 'Ödemelerim'} onBack={back} />
      <MonthPicker ym={ym} label={D.monthName(ym)} setYm={(d) => setYm(D.shiftMonth(ym, d))} />
      <div className={isBill ? 'card warm' : 'card'}>
        <div className="muted small">{isBill ? 'Ödenmemiş toplam' : 'Bu ay kalan ödemeler'}</div>
        <div className="big-num">{D.tl(sum)}</div>
        <div className="small muted">{unpaid[0] ? `En yakın son ödeme: ${D.shortDate(unpaid[0].due)}` : 'Bekleyen yok'}</div>
      </div>
      <Segmented options={[['bekleyen', `Bekleyen (${unpaid.length})`], ['odenen', 'Ödenen']]} value={tab} onChange={setTab} />
      {list.length ? (
        <div className="list">
          {list.map((b) => (
            <div className="item" key={b.id}>
              <div className="date-box">
                <strong>{b.due.slice(8)}</strong>
                <small>{D.shortDate(b.due).split(' ')[1]}</small>
              </div>
              <span className="grow">
                <strong>{b.name}</strong>
                <small className={!b.isPaid && b.daysLeft <= 3 ? 'red' : ''}>
                  {b.isPaid ? 'Ödendi' : b.daysLeft < 0 ? `${-b.daysLeft} gün gecikti` : b.daysLeft === 0 ? 'Bugün son gün' : `${b.daysLeft} gün kaldı`} · {b.repeat === 'aylik' ? 'Her ay' : 'Tek sefer'}
                </small>
              </span>
              <div className="col end">
                <strong>{D.tl(b.amount)}</strong>
                {b.isPaid ? (
                  <button className="mini ghost" onClick={() => unpay(b)}>
                    Geri al
                  </button>
                ) : (
                  <button className="mini" onClick={() => pay(b)}>
                    Ödendi
                  </button>
                )}
              </div>
              <button className="icon-btn small ghost" onClick={() => remove(b)} aria-label="Sil">
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty text={tab === 'bekleyen' ? 'Bekleyen yok.' : 'Bu ay ödenen yok.'} />
      )}
      <p className="muted small hint">"Ödendi" dediğinde tutar harcamalarına işlenir ve bakiyenden düşer.</p>
      {!s.pushOn && (
        <button className="link" onClick={() => go('ayarlar')}>
          Son gün yaklaşınca bildirim almak için bildirimleri aç
        </button>
      )}
      <div className="fab-space" />
      <button className="btn primary fab" onClick={() => setSheet(true)}>
        <Icon name="plus" size={18} /> {isBill ? 'Fatura Ekle' : 'Ödeme Ekle'}
      </button>
      {sheet && <BillSheet ctx={ctx} kind={kind} onClose={() => setSheet(false)} />}
    </>
  );
}

function BillSheet({ ctx, kind, onClose }) {
  const isBill = kind === 'fatura';
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [repeat, setRepeat] = useState('aylik');
  const [day, setDay] = useState(String(new Date().getDate()));
  const [date, setDate] = useState(D.today());
  const presets = isBill ? ['Elektrik', 'Su', 'Doğalgaz', 'İnternet', 'Telefon'] : ['Kira', 'Kredi kartı', 'Abonelik', 'Spor salonu', 'Taksit'];
  return (
    <Sheet title={isBill ? 'Fatura Ekle' : 'Ödeme Ekle'} onClose={onClose}>
      <Field label="Ad">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={presets[0]} />
      </Field>
      <Chips options={presets} value={name} onChange={setName} />
      <Field label="Tutar">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <Segmented options={[['aylik', 'Her ay'], ['tek', 'Tek sefer']]} value={repeat} onChange={setRepeat} />
      {repeat === 'aylik' ? (
        <Field label="Ayın kaçında son gün?">
          <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
        </Field>
      ) : (
        <Field label="Son ödeme tarihi">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      )}
      <button
        className="btn primary"
        onClick={() => {
          const v = D.parseAmount(amount);
          if (!name.trim() || !(v > 0)) return ctx.notify('Ad ve tutar gir');
          ctx.update((x) => void x.bills.push({ id: D.uid(), kind, name: name.trim(), amount: v, repeat, day: Math.min(31, Math.max(1, Number(day) || 1)), date, paid: {} }));
          ctx.notify('Kaydedildi');
          onClose();
        }}
      >
        Kaydet
      </button>
    </Sheet>
  );
}

// ---------- Birikimlerim ----------
function Savings({ ctx }) {
  const { s } = ctx;
  const [sheet, setSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const h = D.holdings(s);
  const total = h.reduce((a, x) => a + x.value, 0);
  const cost = h.reduce((a, x) => a + x.cost, 0);
  const pl = total - cost;
  const history = [...s.savings].sort((a, b) => (a.date + a.id < b.date + b.id ? 1 : -1));

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await D.fetchRates();
      ctx.update((x) => void (x.rates = { ...x.rates, ...r }));
      ctx.notify('Kurlar güncellendi');
    } catch (e) {
      ctx.notify(e.message);
    }
    setLoading(false);
  };

  return (
    <>
      <Header
        title="Birikimlerim"
        onBack={back}
        right={
          <button className={loading ? 'icon-btn spin' : 'icon-btn'} onClick={refresh} aria-label="Kurları yenile">
            <Icon name="refresh" />
          </button>
        }
      />
      <div className="balance gold">
        <span className="bal-label">Toplam birikim (TL)</span>
        <div className="bal">{D.tl(total)}</div>
        <div className="row between small">
          <span>Maliyet {D.tl(cost, 0)}</span>
          <span className={pl >= 0 ? 'up' : 'down'}>
            {pl >= 0 ? '▲' : '▼'} {D.tl(Math.abs(pl), 0)} ({cost ? D.num((pl / cost) * 100, 1) : 0}%)
          </span>
        </div>
        {total > 0 && (
          <div className="stack">
            {h.map((x) => (
              <span key={x.asset} style={{ width: `${(x.value / total) * 100}%`, background: D.ASSETS[x.asset].color }} />
            ))}
          </div>
        )}
      </div>

      <Vault holdings={h} total={total} />

      <div className="section-head">
        <h3>Kâr / zarar</h3>
        <button className="link" onClick={() => setSheet('rates')}>
          Kurlar
        </button>
      </div>
      {h.length ? (
        <div className="list">
          {h.map((x) => (
            <div className="item" key={x.asset}>
              <span className="dot lg" style={{ background: D.ASSETS[x.asset].color }} />
              <span className="grow">
                <strong>{D.ASSETS[x.asset].name}</strong>
                <small>
                  {D.num(x.qty, 3)} {D.ASSETS[x.asset].unit} · ort. {D.tl(x.cost / x.qty)}
                </small>
              </span>
              <div className="col end">
                <strong>{D.tl(x.value, 0)}</strong>
                {x.noRate ? (
                  <small>kur bekleniyor</small>
                ) : (
                  <small className={x.pl >= 0 ? 'green' : 'red'}>
                    {x.pl >= 0 ? '+' : '−'}
                    {D.tl(Math.abs(x.pl), 0)} ({D.num(x.plPct, 1)}%)
                  </small>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Henüz birikim yok. Altın, dolar, euro ya da TL birikimini ekle." />
      )}

      <div className="rates-strip">
        {['GRAM', 'CEYREK', 'USD', 'EUR'].map((a) => (
          <div key={a}>
            <small>{D.ASSETS[a].name}</small>
            <strong>{D.rateOf(s, a) ? D.tl(D.rateOf(s, a)) : '—'}</strong>
          </div>
        ))}
      </div>
      <p className="muted small hint">
        {s.rates.updatedAt ? `Kurlar ${new Date(s.rates.updatedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} tarihinde güncellendi.` : 'Kurlar henüz alınmadı.'} Altın, ons fiyatından hesaplanır; kuyumcu fiyatı farklıysa "Kurlar"dan düzeltebilirsin.
      </p>

      {history.length > 0 && (
        <>
          <div className="section-head">
            <h3>Hareketler</h3>
          </div>
          <div className="list">
            {history.map((v) => (
              <div className="item" key={v.id}>
                <span className="grow">
                  <strong>
                    {D.ASSETS[v.asset].name} {v.dir === 'alim' ? 'alım' : 'satış'}
                  </strong>
                  <small>
                    {D.shortDate(v.date)} · {D.num(v.qty, 3)} {D.ASSETS[v.asset].unit} × {D.tl(v.price)}
                  </small>
                </span>
                <span className={v.dir === 'alim' ? 'amt' : 'amt in'}>{D.tl(v.qty * v.price, 0)}</span>
                <button
                  className="icon-btn small ghost"
                  aria-label="Sil"
                  onClick={() => confirm('Bu hareket silinsin mi?') && ctx.update((x) => void (x.savings = x.savings.filter((y) => y.id !== v.id)))}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="fab-space" />
      <div className="fab row gap">
        <button className="btn primary grow" onClick={() => setSheet('alim')}>
          <Icon name="plus" size={18} /> Alım
        </button>
        <button className="btn grow" onClick={() => setSheet('satim')}>
          <Icon name="minus" size={18} /> Satış
        </button>
      </div>
      {(sheet === 'alim' || sheet === 'satim') && <SavingSheet ctx={ctx} dir={sheet} onClose={() => setSheet(null)} />}
      {sheet === 'rates' && <RatesSheet ctx={ctx} onClose={() => setSheet(null)} />}
    </>
  );
}

function SavingSheet({ ctx, dir, onClose }) {
  const [asset, setAsset] = useState('GRAM');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(() => {
    const r = D.rateOf(ctx.s, 'GRAM');
    return r ? D.num(r, 2) : '';
  });
  const [date, setDate] = useState(D.today());
  const [affects, setAffects] = useState(true);
  const names = Object.fromEntries(Object.entries(D.ASSETS).map(([k, v]) => [v.name, k]));
  const pickAsset = (name) => {
    const k = names[name];
    setAsset(k);
    const r = D.rateOf(ctx.s, k);
    setPrice(r ? D.num(r, 2) : '');
  };
  const q = D.parseAmount(qty), p = asset === 'TL' ? 1 : D.parseAmount(price);
  return (
    <Sheet title={dir === 'alim' ? 'Birikim Alımı' : 'Birikim Satışı'} onClose={onClose}>
      <Chips options={Object.values(D.ASSETS).map((a) => a.name)} value={D.ASSETS[asset].name} onChange={pickAsset} />
      <div className="row gap">
        <Field label={`Miktar (${D.ASSETS[asset].unit})`}>
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus />
        </Field>
        {asset !== 'TL' && (
          <Field label="Birim fiyat (TL)">
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label="Tarih">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="total-line">
        Toplam: <strong>{D.tl(q * p)}</strong>
      </div>
      <Check checked={affects} onChange={setAffects} label={dir === 'alim' ? 'Tutarı bakiyemden düş' : 'Tutarı bakiyeme ekle'} />
      <p className="muted small">Daha önceden elinde olan birikimi giriyorsan bu kutuyu kaldır.</p>
      <button
        className="btn primary"
        onClick={() => {
          if (!(q > 0) || !(p > 0)) return ctx.notify('Miktar ve fiyat gir');
          ctx.update((x) => void x.savings.push({ id: D.uid(), date, asset, dir, qty: q, price: p, affects }));
          ctx.notify(dir === 'alim' ? 'Kumbaraya düştü!' : 'Kumbaradan çıktı');
          onClose();
        }}
      >
        Kaydet
      </button>
    </Sheet>
  );
}

function RatesSheet({ ctx, onClose }) {
  const keys = ['GRAM', 'CEYREK', 'USD', 'EUR'];
  const [vals, setVals] = useState(() => Object.fromEntries(keys.map((k) => [k, ctx.s.rates.manual?.[k] ? D.num(ctx.s.rates.manual[k], 2) : ''])));
  return (
    <Sheet title="Kurlar" onClose={onClose}>
      <p className="muted small">Otomatik kur yanında yazar. Kuyumcu/banka fiyatını kullanmak istersen elle yaz; boş bırakırsan otomatik kur kullanılır.</p>
      {keys.map((k) => (
        <div className="row gap center limit-row" key={k}>
          <span className="grow">
            {D.ASSETS[k].name}
            <br />
            <small className="muted">Otomatik: {ctx.s.rates[k] ? D.tl(ctx.s.rates[k]) : '—'}</small>
          </span>
          <AmountInput value={vals[k]} onChange={(v) => setVals({ ...vals, [k]: v })} />
        </div>
      ))}
      <button
        className="btn primary"
        onClick={() => {
          ctx.update((x) => void (x.rates.manual = Object.fromEntries(keys.map((k) => [k, D.parseAmount(vals[k])]))));
          onClose();
        }}
      >
        Kaydet
      </button>
    </Sheet>
  );
}

// ---------- Hedeflerim ----------
const GOAL_ICONS = ['📱', '💻', '🚗', '✈️', '🏠', '🎓', '🎮', '💍', '🎁', '⭐'];
const LEVELS = [
  [0, 'Başlangıç'],
  [25, 'Çırak'],
  [50, 'Yarı yol'],
  [75, 'Usta'],
  [100, 'Hedefe ulaştı'],
];
const levelOf = (p) => LEVELS.filter(([t]) => p >= t).pop()[1];

function Goals({ ctx }) {
  const { s } = ctx;
  const [sheet, setSheet] = useState(null);
  const [drops, setDrops] = useState({});
  const active = s.goals.filter((g) => !g.done);
  const done = s.goals.filter((g) => g.done);
  const sumSaved = active.reduce((a, g) => a + D.goalSaved(g), 0);
  const sumTarget = active.reduce((a, g) => a + g.target, 0);

  const contribute = (g, amount, affects) => {
    const before = g.target ? (D.goalSaved(g) / g.target) * 100 : 0;
    const after = g.target ? ((D.goalSaved(g) + amount) / g.target) * 100 : 0;
    ctx.update((x) => {
      const goal = x.goals.find((y) => y.id === g.id);
      goal.contribs.push({ id: D.uid(), date: D.today(), amount, affects });
    });
    setDrops({ ...drops, [g.id]: (drops[g.id] || 0) + 1 });
    const hit = [100, 75, 50, 25].find((t) => before < t && after >= t);
    if (hit === 100) ctx.celebrate(`Tebrikler! ${g.name} hedefine ulaştın!`);
    else if (hit) ctx.celebrate(`%${hit} tamam! ${levelOf(hit)} seviyesine geçtin.`);
    else if (amount > 0) ctx.notify(`${D.tl(amount, 0)} kumbaraya atıldı`);
  };

  return (
    <>
      <Header title="Hedeflerim" onBack={back} />
      <div className="motivation">
        <Icon name="spark" size={18} color="#8A5A0B" />
        <span>{D.dailyMessage(s)}</span>
      </div>
      {active.length > 0 && (
        <div className="card">
          <div className="row between end">
            <div>
              <div className="muted small">Hedeflerde biriken</div>
              <div className="big-num">{D.tl(sumSaved, 0)}</div>
            </div>
            <div className="muted small">/ {D.tl(sumTarget, 0)}</div>
          </div>
          <Bar pct={sumTarget ? (sumSaved / sumTarget) * 100 : 0} color="#6B3FA0" height={10} />
        </div>
      )}

      {active.length ? (
        active.map((g) => {
          const saved = D.goalSaved(g);
          const pct = g.target ? (saved / g.target) * 100 : 0;
          const left = Math.max(0, g.target - saved);
          const days = g.deadline ? D.daysBetween(D.today(), g.deadline) : null;
          return (
            <div className="goal" key={g.id}>
              <Jar pct={pct} drop={drops[g.id] || 0} color={pct >= 100 ? '#2E8B57' : '#D9A520'} size={96} />
              <div className="grow col">
                <div className="row gap center">
                  <span className="goal-ic">{g.icon}</span>
                  <strong className="grow">{g.name}</strong>
                </div>
                <span className="badge">{levelOf(pct)}</span>
                <div className="small">
                  <strong>{D.tl(saved, 0)}</strong> <span className="muted">/ {D.tl(g.target, 0)}</span>
                </div>
                <div className="small muted">
                  {left > 0
                    ? days > 0
                      ? `Kalan ${D.tl(left, 0)} · günde ${D.tl(left / days, 0)} (${days} gün)`
                      : days !== null
                      ? `Kalan ${D.tl(left, 0)} · hedef tarihi geçti`
                      : `Kalan ${D.tl(left, 0)}`
                    : 'Hedefe ulaştın!'}
                </div>
                <div className="row gap">
                  <button className="mini" onClick={() => setSheet({ type: 'add', goal: g })}>
                    + Para koy
                  </button>
                  <button className="mini ghost" onClick={() => setSheet({ type: 'take', goal: g })}>
                    Çek
                  </button>
                  {pct >= 100 ? (
                    <button className="mini ghost" onClick={() => ctx.update((x) => void (x.goals.find((y) => y.id === g.id).done = true))}>
                      Arşivle
                    </button>
                  ) : (
                    <button
                      className="mini ghost"
                      onClick={() => confirm(`${g.name} hedefi silinsin mi? Biriken para bakiyene geri döner.`) && ctx.update((x) => void (x.goals = x.goals.filter((y) => y.id !== g.id)))}
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <Empty text="Henüz hedef yok. Yeni telefon, tatil, araba… İlk hedefini ekle!" />
      )}

      {done.length > 0 && (
        <>
          <div className="section-head">
            <h3>Ulaşılan hedefler</h3>
          </div>
          <div className="list">
            {done.map((g) => (
              <div className="item" key={g.id}>
                <span className="goal-ic">{g.icon}</span>
                <strong className="grow">{g.name}</strong>
                <span className="badge green">{D.tl(D.goalSaved(g), 0)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="fab-space" />
      <button className="btn primary fab" onClick={() => setSheet({ type: 'new' })}>
        <Icon name="plus" size={18} /> Hedef Ekle
      </button>

      {sheet?.type === 'new' && <GoalSheet ctx={ctx} onClose={() => setSheet(null)} />}
      {(sheet?.type === 'add' || sheet?.type === 'take') && (
        <ContribSheet
          goal={sheet.goal}
          take={sheet.type === 'take'}
          onClose={() => setSheet(null)}
          onSave={(amt, affects) => {
            contribute(sheet.goal, sheet.type === 'take' ? -Math.min(amt, D.goalSaved(sheet.goal)) : amt, affects);
            setSheet(null);
          }}
        />
      )}
    </>
  );
}

function GoalSheet({ ctx, onClose }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  return (
    <Sheet title="Yeni Hedef" onClose={onClose}>
      <div className="icons">
        {GOAL_ICONS.map((i) => (
          <button key={i} type="button" className={i === icon ? 'on' : ''} onClick={() => setIcon(i)} aria-label={`Simge ${i}`}>
            {i}
          </button>
        ))}
      </div>
      <Field label="Hedef adı">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Yeni telefon" autoFocus />
      </Field>
      <Field label="Hedef tutar">
        <AmountInput value={target} onChange={setTarget} />
      </Field>
      <Field label="Hedef tarih (isteğe bağlı)">
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      <button
        className="btn primary"
        onClick={() => {
          const t = D.parseAmount(target);
          if (!name.trim() || !(t > 0)) return ctx.notify('Ad ve tutar gir');
          ctx.update((x) => void x.goals.push({ id: D.uid(), name: name.trim(), icon, target: t, deadline: deadline || null, created: D.today(), done: false, contribs: [] }));
          ctx.notify('Hedef eklendi');
          onClose();
        }}
      >
        Hedefi Oluştur
      </button>
    </Sheet>
  );
}

function ContribSheet({ goal, take, onClose, onSave }) {
  const [amt, setAmt] = useState('');
  const [affects, setAffects] = useState(true);
  return (
    <Sheet title={take ? `${goal.name}: para çek` : `${goal.name}: para koy`} onClose={onClose}>
      <AmountInput value={amt} onChange={setAmt} big autoFocus />
      {!take && (
        <div className="quick">
          {['50', '100', '250', '500'].map((q) => (
            <button key={q} type="button" className={amt === q ? 'chip on' : 'chip'} onClick={() => setAmt(q)}>
              ₺{q}
            </button>
          ))}
        </div>
      )}
      <Check checked={affects} onChange={setAffects} label={take ? 'Bakiyeme geri ekle' : 'Bakiyemden düş'} />
      <button className="btn primary" onClick={() => D.parseAmount(amt) > 0 && onSave(D.parseAmount(amt), affects)}>
        {take ? 'Çek' : 'Kumbaraya at'}
      </button>
    </Sheet>
  );
}

// ---------- Borçlarım ----------
function Debts({ ctx }) {
  const { s } = ctx;
  const [tab, setTab] = useState('acik');
  const [sheet, setSheet] = useState(null);
  const [open, setOpen] = useState(null);
  const withRem = s.debts.map((d) => ({ ...d, rem: D.debtRemaining(d), total: D.debtTotal(d) }));
  const owe = withRem.filter((d) => d.dir === 'borcum').reduce((a, d) => a + d.rem, 0);
  const owed = withRem.filter((d) => d.dir === 'alacagim').reduce((a, d) => a + d.rem, 0);
  const list = withRem.filter((d) => (tab === 'acik' ? d.rem > 0 : d.rem <= 0));

  return (
    <>
      <Header title="Borçlarım" onBack={back} />
      <div className="row gap">
        <div className="card grow warmred">
          <div className="muted small">Borcum</div>
          <div className="big-num sm red">{D.tl(owe, 0)}</div>
        </div>
        <div className="card grow">
          <div className="muted small">Alacağım</div>
          <div className="big-num sm green">{D.tl(owed, 0)}</div>
        </div>
      </div>
      <Segmented options={[['acik', 'Açık'], ['kapandi', 'Kapanan']]} value={tab} onChange={setTab} />

      {list.length ? (
        list.map((d) => {
          const paid = d.total - d.rem;
          const isOpen = open === d.id;
          return (
            <div className="debt" key={d.id}>
              <button className="debt-head" onClick={() => setOpen(isOpen ? null : d.id)}>
                <span className={d.dir === 'borcum' ? 'avatar red' : 'avatar green'}>{d.person.slice(0, 2).toUpperCase()}</span>
                <span className="grow">
                  <strong>{d.person}</strong>
                  <small>
                    {d.dir === 'borcum' ? 'Borcum' : 'Alacağım'}
                    {d.due ? ` · vade ${D.shortDate(d.due)}` : ''}
                    {d.note ? ` · ${d.note}` : ''}
                  </small>
                </span>
                <span className="col end">
                  <strong>{D.tl(d.rem, 0)}</strong>
                  <small className="muted">/ {D.tl(d.total, 0)}</small>
                </span>
              </button>
              <Bar pct={d.total ? (paid / d.total) * 100 : 0} height={6} color={d.dir === 'borcum' ? 'var(--green)' : '#26386E'} />
              <div className="row gap">
                {d.rem > 0 && (
                  <button className="mini" onClick={() => setSheet({ type: 'odeme', debt: d })}>
                    {d.dir === 'borcum' ? 'Ödeme yaptım' : 'Ödeme aldım'}
                  </button>
                )}
                <button className="mini ghost" onClick={() => setSheet({ type: 'artis', debt: d })}>
                  Borç arttı
                </button>
                <button className="mini ghost" onClick={() => setOpen(isOpen ? null : d.id)}>
                  {isOpen ? 'Gizle' : 'Geçmiş'}
                </button>
              </div>
              {isOpen && (
                <div className="history">
                  {[...d.moves].reverse().map((m) => (
                    <div className="row between small" key={m.id}>
                      <span>
                        {D.shortDate(m.date)} · {m.type === 'baslangic' ? 'Başlangıç' : m.type === 'odeme' ? 'Ödeme' : 'Artış'}
                        {m.note ? ` · ${m.note}` : ''}
                      </span>
                      <span className={m.type === 'odeme' ? 'green' : 'red'}>
                        {m.type === 'odeme' ? '−' : '+'}
                        {D.tl(m.amount, 0)}
                      </span>
                    </div>
                  ))}
                  <button
                    className="link red"
                    onClick={() => confirm(`${d.person} kaydı tamamen silinsin mi?`) && ctx.update((x) => void (x.debts = x.debts.filter((y) => y.id !== d.id)))}
                  >
                    Kaydı sil
                  </button>
                </div>
              )}
            </div>
          );
        })
      ) : (
        <Empty text={tab === 'acik' ? 'Açık borç yok.' : 'Kapanan borç yok.'} />
      )}

      <div className="fab-space" />
      <button className="btn primary fab" onClick={() => setSheet({ type: 'new' })}>
        <Icon name="plus" size={18} /> Borç / Alacak Ekle
      </button>
      {sheet?.type === 'new' && <DebtSheet ctx={ctx} onClose={() => setSheet(null)} />}
      {(sheet?.type === 'odeme' || sheet?.type === 'artis') && <MoveSheet ctx={ctx} debt={sheet.debt} type={sheet.type} onClose={() => setSheet(null)} />}
    </>
  );
}

function DebtSheet({ ctx, onClose }) {
  const [person, setPerson] = useState('');
  const [dir, setDir] = useState('borcum');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [note, setNote] = useState('');
  const [affects, setAffects] = useState(false);
  return (
    <Sheet title="Borç / Alacak Ekle" onClose={onClose}>
      <Segmented options={[['borcum', 'Borcum var'], ['alacagim', 'Alacağım var']]} value={dir} onChange={setDir} />
      <Field label="Kime / kimden">
        <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Örn. Ahmet, Kredi kartı, KYK" autoFocus />
      </Field>
      <Field label="Tutar">
        <AmountInput value={amount} onChange={setAmount} />
      </Field>
      <div className="row gap">
        <Field label="Vade (isteğe bağlı)">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Not">
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <Check checked={affects} onChange={setAffects} label={dir === 'borcum' ? 'Bu para bakiyeme girdi' : 'Bu para bakiyemden çıktı'} />
      <button
        className="btn primary"
        onClick={() => {
          const v = D.parseAmount(amount);
          if (!person.trim() || !(v > 0)) return ctx.notify('Kişi ve tutar gir');
          ctx.update((x) =>
            void x.debts.push({ id: D.uid(), person: person.trim(), dir, due: due || null, note: note.trim(), created: D.today(), moves: [{ id: D.uid(), date: D.today(), type: 'baslangic', amount: v, note: '', affects }] })
          );
          ctx.notify('Kaydedildi');
          onClose();
        }}
      >
        Kaydet
      </button>
    </Sheet>
  );
}

function MoveSheet({ ctx, debt, type, onClose }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [affects, setAffects] = useState(type === 'odeme');
  const isPay = type === 'odeme';
  const borcum = debt.dir === 'borcum';
  return (
    <Sheet title={`${debt.person}: ${isPay ? (borcum ? 'ödeme yaptım' : 'ödeme aldım') : 'borç arttı'}`} onClose={onClose}>
      <p className="muted small">Kalan: {D.tl(debt.rem)}</p>
      <AmountInput value={amount} onChange={setAmount} big autoFocus />
      {isPay && (
        <button type="button" className="chip" onClick={() => setAmount(D.num(debt.rem, 2))}>
          Tamamı ({D.tl(debt.rem, 0)})
        </button>
      )}
      <Field label="Not">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isPay ? 'Örn. Kasım taksiti' : 'Örn. faiz, yeni borç'} />
      </Field>
      <Check
        checked={affects}
        onChange={setAffects}
        label={isPay ? (borcum ? 'Tutarı bakiyemden düş' : 'Tutarı bakiyeme ekle') : borcum ? 'Bu para bakiyeme girdi' : 'Bu para bakiyemden çıktı'}
      />
      <button
        className="btn primary"
        onClick={() => {
          let v = D.parseAmount(amount);
          if (!(v > 0)) return ctx.notify('Tutar gir');
          if (isPay) v = Math.min(v, debt.rem);
          const closes = isPay && v >= debt.rem;
          ctx.update((x) => void x.debts.find((d) => d.id === debt.id).moves.push({ id: D.uid(), date: D.today(), type, amount: v, note: note.trim(), affects }));
          if (closes) ctx.celebrate(borcum ? `${debt.person} borcu kapandı!` : `${debt.person} alacağı tahsil edildi!`);
          else ctx.notify('Kaydedildi');
          onClose();
        }}
      >
        Kaydet
      </button>
    </Sheet>
  );
}

// ---------- Bildirimler ----------
function PushCard({ ctx }) {
  const { s } = ctx;
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) ctx.notify(ok);
    } catch (e) {
      ctx.notify(e.message || 'Bir hata oldu');
    }
    setBusy(false);
  };
  const needInstall = P.isIOS() && !P.isStandalone();
  const count = s.bills.length;

  return (
    <div className="card">
      <h3>Ödeme bildirimleri</h3>
      <p className="muted small">
        {s.pushOn
          ? `Açık. ${count} fatura/ödeme için son günden 2 gün önce ve son gün; 09:00, 14:00 ve 20:00'de bildirim gelir.`
          : 'Fatura ve ödemelerin son günü yaklaşınca telefonuna bildirim gelsin.'}
      </p>
      {needInstall && <p className="small red">Bildirimler için uygulamayı ana ekrandaki ikondan aç.</p>}
      <div className="row gap wrap">
        {s.pushOn ? (
          <>
            <button className="btn small" disabled={busy} onClick={() => run(P.testPush, 'Deneme bildirimi gönderildi')}>
              Deneme gönder
            </button>
            <button
              className="btn small ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await P.disablePush();
                  ctx.update((x) => void (x.pushOn = false));
                }, 'Bildirimler kapatıldı')
              }
            >
              Kapat
            </button>
          </>
        ) : (
          <button
            className="btn small primary"
            disabled={busy || needInstall}
            onClick={() =>
              run(async () => {
                await P.enablePush(s.bills);
                ctx.update((x) => void (x.pushOn = true));
              }, 'Bildirimler açıldı')
            }
          >
            {busy ? 'Açılıyor…' : 'Bildirimleri aç'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Ayarlar ----------
function Settings({ ctx }) {
  const { s } = ctx;
  const [bal, setBal] = useState('');
  const [pin, setPin] = useState('');
  const fileRef = React.useRef();
  const current = D.balance(s);

  return (
    <>
      <Header title="Ayarlar" onBack={back} />

      <div className="card">
        <h3>Bakiye eşitleme</h3>
        <p className="muted small">Uygulamadaki bakiye: {D.tl(current)}. Bankadaki gerçek tutarı yaz, fark "Düzeltme" olarak kaydedilir.</p>
        <div className="row gap">
          <AmountInput value={bal} onChange={setBal} />
          <button
            className="btn small"
            onClick={() => {
              const real = D.parseAmount(bal);
              const diff = Math.round((real - current) * 100) / 100;
              if (!bal || !diff) return ctx.notify('Fark yok');
              ctx.update((x) => void x.transactions.push({ id: D.uid(), date: D.today(), type: diff > 0 ? 'gelir' : 'gider', amount: Math.abs(diff), category: 'Düzeltme', note: 'Bakiye eşitleme' }));
              setBal('');
              ctx.notify('Bakiye eşitlendi');
            }}
          >
            Eşitle
          </button>
        </div>
      </div>

      <PushCard ctx={ctx} />

      <div className="card">
        <h3>PIN kilidi</h3>
        <p className="muted small">{s.pinHash ? 'Uygulama açılışta PIN istiyor.' : 'Açılışta 4 haneli PIN istesin.'}</p>
        <div className="row gap">
          <input inputMode="numeric" maxLength={4} placeholder="4 hane" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <button
            className="btn small"
            onClick={async () => {
              if (pin.length !== 4) return ctx.notify('4 haneli PIN gir');
              const h = await D.hashPin(pin);
              ctx.update((x) => void (x.pinHash = h));
              setPin('');
              ctx.notify('PIN ayarlandı');
            }}
          >
            {s.pinHash ? 'Değiştir' : 'Ayarla'}
          </button>
          {s.pinHash && (
            <button className="btn small ghost" onClick={() => ctx.update((x) => void (x.pinHash = null))}>
              Kapat
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Yedek</h3>
        <p className="muted small">Veriler sadece bu telefonda durur. Düzenli yedek al; telefon değişirse yedekten geri yüklersin.</p>
        <div className="row gap wrap">
          <button className="btn small" onClick={() => D.downloadFile(`cuzdanim-yedek-${D.today()}.json`, JSON.stringify(s), 'application/json')}>
            Yedek indir
          </button>
          <button className="btn small" onClick={() => fileRef.current.click()}>
            Yedekten yükle
          </button>
          <button className="btn small" onClick={() => D.downloadFile(`cuzdanim-islemler-${D.today()}.csv`, D.exportCsv(s), 'text/csv;charset=utf-8')}>
            Excel (CSV) indir
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            try {
              const data = JSON.parse(await f.text());
              if (!data.transactions) throw new Error();
              if (!confirm('Mevcut veriler yedektekiyle değiştirilsin mi?')) return;
              ctx.update(() => ({ ...D.resetAll(), ...data }));
              ctx.notify('Yedek yüklendi');
            } catch {
              ctx.notify('Geçersiz yedek dosyası');
            }
            e.target.value = '';
          }}
        />
      </div>

      <div className="card">
        <h3>Sıfırla</h3>
        <p className="muted small">Tüm veriler silinir. Önce yedek almanı öneririm.</p>
        <button
          className="btn small danger"
          onClick={() => {
            if (!confirm('Tüm veriler kalıcı olarak silinsin mi?')) return;
            ctx.update(() => D.resetAll());
            go('home');
          }}
        >
          Tüm verileri sil
        </button>
      </div>
      <p className="muted small hint">Cüzdanım v1.0 · Kurlar: fawazahmed0/currency-api</p>
    </>
  );
}
