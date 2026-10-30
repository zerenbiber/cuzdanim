// /api/push
// GET  -> { publicKey }
// POST { action: 'sync', subscription, bills }  -> bu cihazın fatura listesini kaydeder
// POST { action: 'test', subscription }         -> hemen deneme bildirimi gönderir
// POST { action: 'remove', endpoint }           -> bildirimleri kapatır
import { subs, keyOf, setupVapid, validSubscription, cleanBills } from '../lib/push.mjs';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method === 'GET') return json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'json' }, 400);
  }
  const { action, subscription, bills, endpoint } = body || {};

  if (action === 'remove') {
    if (typeof endpoint === 'string') await subs().delete(keyOf(endpoint));
    return json({ ok: true });
  }

  if (!validSubscription(subscription)) return json({ error: 'subscription' }, 400);
  const sub = { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } };

  if (action === 'sync') {
    const clean = cleanBills(bills);
    await subs().setJSON(keyOf(sub.endpoint), { subscription: sub, bills: clean, updatedAt: Date.now() });
    return json({ ok: true, count: clean.length });
  }

  if (action === 'test') {
    try {
      const webpush = setupVapid();
      await webpush.sendNotification(sub, JSON.stringify({ title: 'Cüzdanım', body: 'Bildirimler çalışıyor! Ödeme günlerinde sana haber vereceğim.', url: './#/faturalar' }), { TTL: 3600 });
      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message || 'gönderilemedi', status: e.statusCode }, 500);
    }
  }

  return json({ error: 'action' }, 400);
};

export const config = { path: '/api/push' };
