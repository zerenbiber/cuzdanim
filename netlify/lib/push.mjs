import webpush from 'web-push';
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

export const subs = () => getStore('push-subs');
export const keyOf = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 40);

export function setupVapid() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('VAPID anahtarları eksik (Netlify > Environment variables)');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || process.env.URL || 'https://cuzdanim.netlify.app', pub, priv);
  return webpush;
}

// Sadece bilinen tarayıcı bildirim servislerine izin ver
export function validSubscription(s) {
  try {
    const u = new URL(s?.endpoint);
    const known = /(^|\.)(push\.apple\.com|googleapis\.com|mozilla\.com|mozaws\.net|notify\.windows\.com)$/.test(u.hostname);
    return u.protocol === 'https:' && known && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
  } catch {
    return false;
  }
}

export function cleanBills(bills) {
  return (Array.isArray(bills) ? bills : []).slice(0, 100).map((b) => ({
    name: String(b?.name || 'Ödeme').slice(0, 60),
    amount: Number(b?.amount) || 0,
    kind: b?.kind === 'odeme' ? 'odeme' : 'fatura',
    repeat: b?.repeat === 'tek' ? 'tek' : 'aylik',
    day: Math.min(31, Math.max(1, Number(b?.day) || 1)),
    date: /^\d{4}-\d{2}-\d{2}$/.test(b?.date || '') ? b.date : null,
    paid: (Array.isArray(b?.paid) ? b.paid : []).filter((k) => /^\d{4}-\d{2}$/.test(k)).slice(-24),
  }));
}
