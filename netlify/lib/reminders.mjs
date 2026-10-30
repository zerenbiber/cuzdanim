// Hangi fatura/ödeme için bugün hatırlatma gönderileceğini hesaplar.
// Saat dilimi: Türkiye.

export const REMIND_DAYS = [2, 0]; // son günden 2 gün önce ve son gün

const pad = (n) => String(n).padStart(2, '0');

export const todayTR = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const shiftMonth = (ym, k) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function dueReminders(bills, today) {
  const ym = today.slice(0, 7);
  const out = [];
  for (const b of bills || []) {
    const paid = b.paid || [];
    let candidates;
    if (b.repeat === 'tek') {
      if (!b.date || paid.length) continue;
      candidates = [[b.date, b.date.slice(0, 7)]];
    } else {
      candidates = [ym, shiftMonth(ym, 1)].map((m) => {
        const [y, mm] = m.split('-').map(Number);
        const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
        return [`${m}-${pad(Math.min(b.day, last))}`, m];
      });
    }
    for (const [due, m] of candidates) {
      if (b.repeat !== 'tek' && paid.includes(m)) continue;
      const days = daysBetween(today, due);
      if (REMIND_DAYS.includes(days)) out.push({ name: b.name, amount: b.amount, kind: b.kind, days });
    }
  }
  return out;
}

// Günün hangi bildirimi: sabah / öğlen / akşam
export const hourTR = (d = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false }).format(d));
export const slotTR = (d = new Date()) => {
  const h = hourTR(d);
  return h < 12 ? 'sabah' : h < 15 ? 'oglen' : h < 17 ? 'kumbara' : 'aksam'; // 09 / 14 / 15 / 20
};

export function buildPayload(items, slot = 'sabah') {
  const lead = slot === 'aksam' ? 'Unutma: ' : slot === 'oglen' ? 'Hatırlatma: ' : '';
  const money = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺';
  const when = (d) => (d === 0 ? 'bugün son gün' : d === 1 ? 'yarın son gün' : `${d} gün kaldı`);
  const url = items.every((i) => i.kind === 'odeme') ? './#/odemeler' : './#/faturalar';
  if (items.length === 1) {
    const i = items[0];
    return { title: `${lead}${i.name} ödemesi`, body: `${money(i.amount)} · ${when(i.days)}`, url };
  }
  return { title: `${lead}${items.length} ödemen yaklaşıyor`, body: items.map((i) => `${i.name} ${money(i.amount)} (${when(i.days)})`).join(', '), url };
}

// ---------- Günlük kumbara hatırlatması ----------
const roundUp = (n, step) => Math.ceil(n / step) * step;

// Kumbara mesajı için gerçekler: ad, önerilen tutar, odak hedef
export function nudgeFacts(sv, today) {
  const open = (sv?.goals || []).filter((g) => g.target > g.saved);
  let amount = sv?.amount || 100;
  let goal = null;
  if (open.length) {
    // En yakın tarihli hedef, yoksa en çok ilerlemiş hedef
    const g = [...open].sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
      if (a.deadline || b.deadline) return a.deadline ? -1 : 1;
      return b.saved / b.target - a.saved / a.target;
    })[0];
    const days = g.deadline ? daysBetween(today, g.deadline) : 0;
    if (days > 0) amount = Math.max(10, roundUp((g.target - g.saved) / days, 10));
    goal = { name: g.name, pct: Math.round((g.saved / g.target) * 100), left: g.target - g.saved, days };
  }
  return { name: sv?.name || '', amount, goal };
}

export function nudgeText(f) {
  const money = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺';
  const hi = f.name ? `${f.name}, ` : '';
  const body = f.goal
    ? `${hi}bugün kumbarana ${money(f.amount)} at. ${f.goal.name} hedefinde %${f.goal.pct} tamam, kalan ${money(f.goal.left)}.`
    : `${hi}bugün kumbarana ${money(f.amount)} at. Küçük adımlar büyük birikime dönüşür!`;
  return body.charAt(0).toLocaleUpperCase('tr-TR') + body.slice(1);
}

export function savingsNudge(sv, today) {
  if (!sv || sv.on === false) return null;
  if (sv.lastContrib === today) return null; // bugün zaten para atılmış
  const facts = nudgeFacts(sv, today);
  return { title: 'Kumbara zamanı', body: nudgeText(facts), url: './#/hedefler', facts };
}
