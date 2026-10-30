// Bildirim aboneliği (iPhone'da ana ekrana eklenmiş uygulamada çalışır, iOS 16.4+)

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

const slim = (bills) =>
  bills.map((b) => ({ name: b.name, amount: b.amount, kind: b.kind, repeat: b.repeat, day: b.day, date: b.date, paid: Object.keys(b.paid || {}) }));

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function api(body) {
  const res = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Sunucu hatası');
  return data;
}

async function currentSub() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(bills) {
  if (!pushSupported()) throw new Error(isIOS() && !isStandalone() ? 'Uygulamayı ana ekrandaki ikondan aç' : 'Bu cihaz bildirimleri desteklemiyor');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Bildirim izni verilmedi. Ayarlar > Bildirimler > Cüzdanım');
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch('/api/push')).json();
  if (!publicKey) throw new Error('Sunucuda bildirim anahtarı yok');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  await api({ action: 'sync', subscription: sub.toJSON(), bills: slim(bills) });
}

export async function syncBills(bills) {
  const sub = await currentSub();
  if (sub) await api({ action: 'sync', subscription: sub.toJSON(), bills: slim(bills) });
}

export async function testPush() {
  const sub = await currentSub();
  if (!sub) throw new Error('Önce bildirimleri aç');
  await api({ action: 'test', subscription: sub.toJSON() });
}

export async function disablePush() {
  const sub = await currentSub();
  if (!sub) return;
  await api({ action: 'remove', endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
