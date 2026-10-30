// Gemini ile kısa, kişisel motivasyon mesajı üretir.
// Anahtar yoksa ya da hata olursa null döner; çağıran taraf hazır mesaja geçer.
// Google'ın önerdiği güncel modeller; ilki olmazsa sıradakini dener. GEMINI_MODEL ile değiştirilebilir.
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.8-flash,gemini-flash-latest').split(',').map((m) => m.trim()).filter(Boolean);

const money = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺';

function clean(t) {
  return t
    .replace(/\p{Extended_Pictographic}\uFE0F?/gu, '')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .slice(0, 220)
    .trim();
}

// Son hatayı tanı için sakla (anahtarın kendisi asla yazılmaz)
export const lastAiError = { value: null };

export async function aiText(prompt) {
  const key = process.env.GEMINI_API_KEY;
  lastAiError.value = null;
  if (!key) {
    lastAiError.value = 'GEMINI_API_KEY tanımlı değil (Netlify > Environment variables, sonra yeniden deploy)';
    return null;
  }
  const errors = [];
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1, maxOutputTokens: 1024 },
        }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        const detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 220);
        console.error('gemini', model, res.status, detail);
        errors.push(`${model}: ${res.status} ${detail}`);
        continue;
      }
      const j = await res.json();
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
      if (text) return clean(text);
      errors.push(`${model}: boş cevap ${JSON.stringify(j).slice(0, 200)}`);
    } catch (e) {
      console.error('gemini', model, e.message);
      errors.push(`${model}: ${e.message}`);
    }
  }
  lastAiError.value = errors.join(' | ');
  return null;
}

// facts: { name, amount, goal: { name, pct, left, days } | null }
export function nudgePrompt(facts, purpose = 'bildirim') {
  const lines = [
    'Sen kişisel finans uygulaması "Cüzdanım"ın samimi birikim koçusun.',
    purpose === 'bildirim'
      ? 'Türkçe, ÇOK KISA bir günlük kumbara hatırlatması yaz: tek cümle, en fazla 10 kelime, en fazla 70 karakter.'
      : 'Uygulamanın ana ekranında büyük puntoyla gösterilecek ÇOK KISA günün mesajını yaz: tek cümle, en fazla 9 kelime, en fazla 60 karakter.',
    facts.name ? `Kullanıcının adı: ${facts.name}. Adıyla hitap et.` : 'Kullanıcının adını bilmiyorsun, isim kullanma.',
    `Bugün kumbaraya atması önerilen tutar: ${money(facts.amount)}. Bu tutarı rakamla ve ₺ işaretiyle aynen yaz.`,
  ];
  if (facts.goal) {
    const g = facts.goal;
    lines.push(`Hedefi: ${g.name} (%${g.pct} tamamlandı). Kısaysa hedefin adını geçir; yüzde veya kalan tutarı yazmak zorunda değilsin.`);
  } else lines.push('Henüz bir hedefi yok; birikime başlamaya teşvik et.');
  lines.push('Her gün farklı bir üslup kullan: bazen esprili, bazen ilham verici. Kısa ve vurucu olsun. Tırnak, başlık veya açıklama yazma; sadece mesajı yaz. Emoji kullanma.');
  lines.push('Örnek uzunluk: "Zeren, bugün 120 ₺ ile telefona bir adım daha!"');
  return lines.join('\n');
}

// Üretilen metin önerilen tutarı içermiyorsa güvenme
export function looksValid(text, amount) {
  if (!text || text.length < 15 || text.length > 110) return false;
  const digits = String(Math.round(amount));
  return text.replace(/\./g, '').includes(digits);
}
