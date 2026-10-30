// /api/parse  POST { text, categories, incomeTypes, today } -> { items, ai }
// Doğal dildeki kaydı yapay zekayla çözümler. Başarısız olursa { items: null } döner, uygulama yerel çözümleyiciye geçer.
import { parseEntries } from '../lib/parse.mjs';
import { todayTR } from '../lib/reminders.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const strList = (a, max) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, 30)).filter(Boolean).slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'json' }, 400);
  }
  const text = String(body?.text || '').trim().slice(0, 400);
  if (!text) return json({ error: 'text' }, 400);
  const cats = strList(body?.categories, 40);
  const incomes = strList(body?.incomeTypes, 20);
  if (!cats.length || !incomes.length) return json({ error: 'categories' }, 400);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body?.today || '') ? body.today : todayTR();

  const items = await parseEntries(text, cats, incomes, today);
  return json({ items, ai: !!items });
};

export const config = { path: '/api/parse' };
