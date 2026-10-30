// /api/motivation  POST { savings } -> { text, ai }   (GET = test)
// Ana ekrandaki "günün mesajı" için yapay zeka metni üretir.
import { cleanSavings } from '../lib/push.mjs';
import { nudgeFacts, nudgeText, todayTR } from '../lib/reminders.mjs';
import { aiText, nudgePrompt, looksValid, lastAiError } from '../lib/ai.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  let body;
  if (req.method === 'GET') {
    // Tarayıcıdan test: /api/motivation  -> örnek bir mesaj üretir
    body = { savings: { name: 'Test', goals: [{ name: 'Yeni telefon', target: 40000, saved: 11000 }] } };
  } else if (req.method === 'POST') {
    try {
      body = await req.json();
    } catch {
      return json({ error: 'json' }, 400);
    }
  } else return json({ error: 'method' }, 405);
  const facts = nudgeFacts(cleanSavings(body?.savings), todayTR());
  const ai = await aiText(nudgePrompt(facts, 'anasayfa'));
  if (looksValid(ai, facts.amount)) return json({ text: ai, ai: true });
  const out = { text: nudgeText(facts), ai: false };
  if (req.method === 'GET') {
    out.anahtar = process.env.GEMINI_API_KEY ? `var (${process.env.GEMINI_API_KEY.slice(0, 3)}…, ${process.env.GEMINI_API_KEY.length} karakter)` : 'yok';
    out.hata = lastAiError.value || (ai ? `Cevap geldi ama tutar içermiyor: ${ai}` : null);
  }
  return json(out);
};

export const config = { path: '/api/motivation' };
