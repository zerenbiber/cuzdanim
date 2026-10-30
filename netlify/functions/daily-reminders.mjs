// Her sabah 09:00 (Türkiye) çalışır; son günü yaklaşan ödemeler için bildirim gönderir.
import { subs, setupVapid } from '../lib/push.mjs';
import { dueReminders, buildPayload, todayTR } from '../lib/reminders.mjs';

export default async () => {
  const webpush = setupVapid();
  const store = subs();
  const { blobs } = await store.list();
  const today = todayTR();
  let sent = 0;
  let removed = 0;

  for (const { key } of blobs) {
    const rec = await store.get(key, { type: 'json' });
    if (!rec?.subscription) continue;
    const items = dueReminders(rec.bills, today);
    if (!items.length) continue;
    try {
      await webpush.sendNotification(rec.subscription, JSON.stringify(buildPayload(items)), { TTL: 12 * 3600 });
      sent++;
    } catch (e) {
      // Cihaz bildirimi kapattıysa kaydı sil
      if (e.statusCode === 404 || e.statusCode === 410) {
        await store.delete(key);
        removed++;
      } else console.error('push hata', e.statusCode, e.body);
    }
  }
  console.log(`hatırlatma ${today}: ${sent} gönderildi, ${removed} kayıt silindi, ${blobs.length} cihaz`);
  return new Response('ok');
};

export const config = { schedule: '0 6 * * *' }; // 06:00 UTC = 09:00 TR
