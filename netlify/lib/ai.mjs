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

// Gemini'ye istek gönderir, ham metni döndürür (modeller sırayla denenir)
async function gemini(prompt, generationConfig) {
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
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig }),
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
      if (text) return text;
      errors.push(`${model}: boş cevap ${JSON.stringify(j).slice(0, 200)}`);
    } catch (e) {
      console.error('gemini', model, e.message);
      errors.push(`${model}: ${e.message}`);
    }
  }
  lastAiError.value = errors.join(' | ');
  return null;
}

export async function aiText(prompt) {
  const t = await gemini(prompt, { temperature: 1, maxOutputTokens: 1024 });
  return t ? clean(t) : null;
}

// JSON cevap ister; ayrıştırılamazsa null
export async function aiJSON(prompt, schema) {
  const t = await gemini(prompt, { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json', responseSchema: schema });
  if (!t) return null;
  try {
    return JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    lastAiError.value = 'JSON ayrıştırılamadı: ' + t.slice(0, 200);
    return null;
  }
}

// İlerlemeye göre ton: kullanıcıyı gaza getirecek açı
function progressTone(g) {
  if (g.pct >= 90) return 'Hedefe çok az kaldı: "son düzlük", "neredeyse senin" coşkusuyla, zafer havasında yaz.';
  if (g.pct >= 75) return 'Hedefin dörtte üçü tamam: "az kaldı", "bitiş çizgisi göründü" gibi güçlü bir gazla yaz.';
  if (g.pct >= 50) return 'Yarıyı geçti: "yarıyı devirdin", "geri dönüş yok" enerjisiyle yaz.';
  if (g.pct >= 25) return 'İyi bir başlangıç yaptı: istikrarını öv, "ritmi yakaladın" enerjisiyle yaz.';
  if (g.pct > 0) return 'Yolun başında: ilk adımları kutla, "her şey böyle başlar" diye cesaretlendir.';
  return 'Henüz hedefe para koymamış: ilk adımı atması için heyecanlandır.';
}

// facts: { name, amount, goal: { name, pct, left, days } | null }
// purpose: 'bildirim' (15:00 kumbara bildirimi) | 'anasayfa' (ana ekrandaki günün mesajı)
export function nudgePrompt(facts, purpose = 'bildirim') {
  const lines = [
    'Sen kişisel finans uygulaması "Cüzdanım"ın enerjik, samimi birikim koçusun. Kullanıcıyı gaza getirir, başarabileceğine inandırırsın.',
    purpose === 'bildirim'
      ? 'Türkçe, ÇOK KISA bir günlük kumbara hatırlatması yaz: tek cümle, en fazla 10 kelime, en fazla 70 karakter.'
      : 'Uygulamanın ana ekranında büyük puntoyla gösterilecek ÇOK KISA günün mesajını yaz: tek cümle, en fazla 9 kelime, en fazla 60 karakter.',
    facts.name ? `Kullanıcının adı: ${facts.name}. Adıyla hitap et.` : 'Kullanıcının adını bilmiyorsun, isim kullanma.',
    purpose === 'bildirim'
      ? `Bugün kumbaraya atması önerilen tutar: ${money(facts.amount)}. Bu tutarı rakamla ve ₺ işaretiyle aynen yaz.`
      : `Bugün önerilen tutar ${money(facts.amount)}; istersen geçir, zorunlu değil.`,
  ];
  if (facts.goal) {
    const g = facts.goal;
    lines.push(`Hedefi: ${g.name}. %${g.pct} tamamlandı, kalan ${money(g.left)}${g.days > 0 ? `, hedef tarihine ${g.days} gün var` : ''}.`);
    lines.push(progressTone(g));
    lines.push('Hedefin adını mutlaka geçir. "Başarabilirsin", "az kaldı", "durmak yok" gibi gaza getiren ifadeler kullan ama abartıp yalan söyleme.');
  } else lines.push('Henüz bir hedefi yok; ilk hedefini koyup birikime başlaması için heyecanlandır.');
  lines.push('Her gün farklı bir üslup kullan: bazen esprili, bazen spor koçu gibi, bazen ilham verici. Kısa ve vurucu olsun. Tırnak, başlık veya açıklama yazma; sadece mesajı yaz. Emoji kullanma.');
  lines.push('Örnekler: "Zeren, telefonun yarısı cebinde, durmak yok!" / "Az kaldı Zeren, bugün 120 ₺ ile bitiriyoruz!"');
  return lines.join('\n');
}

// Metin makul mu? Bildirimde önerilen tutarın geçmesi şart.
export function looksValid(text, amount, purpose = 'bildirim') {
  if (!text || text.length < 15 || text.length > 110) return false;
  if (purpose !== 'bildirim') return true;
  const digits = String(Math.round(amount));
  return text.replace(/\./g, '').includes(digits);
}
