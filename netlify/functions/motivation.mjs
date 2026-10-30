// /api/motivation  POST { savings } -> { text, ai }
// Ana ekrandaki "günün mesajı" için yapay zeka metni üretir.
import { cleanSavings } from '../lib/push.mjs';
import { nudgeFacts, nudgeText, todayTR } from '../lib/reminders.mjs';
import { aiText, nudgePrompt, looksValid } from '../lib/ai.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'json' }, 400);
  }
  const facts = nudgeFacts(cleanSavings(body?.savings), todayTR());
  const ai = await aiText(nudgePrompt(facts, 'anasayfa'));
  if (looksValid(ai, facts.amount)) return json({ text: ai, ai: true });
  return json({ text: nudgeText(facts), ai: false });
};

export const config = { path: '/api/motivation' };
