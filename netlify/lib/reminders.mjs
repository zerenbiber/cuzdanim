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
export const slotTR = (d = new Date()) => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', hour12: false }).format(d));
  return h < 12 ? 'sabah' : h < 17 ? 'oglen' : 'aksam';
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
