// Günde 4 kez çalışır (Türkiye saati):
// 09:00, 14:00, 20:00 -> son günü yaklaşan fatura/ödeme hatırlatması
// 15:00               -> günlük kumbara hatırlatması
import { subs, setupVapid } from '../lib/push.mjs';
import { dueReminders, buildPayload, savingsNudge, todayTR, slotTR } from '../lib/reminders.mjs';

export default async () => {
  const webpush = setupVapid();
  const store = subs();
  const { blobs } = await store.list();
  const today = todayTR();
  const slot = slotTR();
  let sent = 0;
  let removed = 0;

  for (const { key } of blobs) {
    const rec = await store.get(key, { type: 'json' });
    if (!rec?.subscription) continue;

    let payload = null;
    if (slot === 'kumbara') payload = savingsNudge(rec.savings, today);
    else {
      const items = dueReminders(rec.bills, today);
      if (items.length) payload = buildPayload(items, slot);
    }
    if (!payload) continue;

    try {
      await webpush.sendNotification(rec.subscription, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      // Cihaz bildirimi kapattıysa kaydı sil
      if (e.statusCode === 404 || e.statusCode === 410) {
        await store.delete(key);
        removed++;
      } else console.error('push hata', e.statusCode, e.body);
    }
  }
  console.log(`bildirim ${today} ${slot}: ${sent} gönderildi, ${removed} kayıt silindi, ${blobs.length} cihaz`);
  return new Response('ok');
};

export const config = { schedule: '0 6,11,12,17 * * *' }; // UTC 06/11/12/17 = TR 09:00 / 14:00 / 15:00 / 20:00
