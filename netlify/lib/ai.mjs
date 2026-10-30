// Gemini ile kısa, kişisel motivasyon mesajı üretir.
// Anahtar yoksa ya da hata olursa null döner; çağıran taraf hazır mesaja geçer.
const MODELS = (process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite,gemini-2.5-flash').split(',').map((m) => m.trim()).filter(Boolean);

const money = (n) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n) + ' ₺';

function clean(t) {
  return t
    .replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .slice(0, 220)
    .trim();
}

export async function aiText(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  for (const model of MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1, maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) {
        console.error('gemini', model, res.status, (await res.text()).slice(0, 300));
        continue;
      }
      const j = await res.json();
      const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
      if (text) return clean(text);
    } catch (e) {
      console.error('gemini', model, e.message);
    }
  }
  return null;
}

// facts: { name, amount, goal: { name, pct, left, days } | null }
export function nudgePrompt(facts, purpose = 'bildirim') {
  const lines = [
    'Sen kişisel finans uygulaması "Cüzdanım"ın samimi birikim koçusun.',
    purpose === 'bildirim'
      ? 'Türkçe, tek cümlelik, en fazla 140 karakterlik, sıcak ve motive edici bir günlük kumbara hatırlatması yaz.'
      : 'Uygulamanın ana ekranında gösterilecek, Türkçe, en fazla 160 karakterlik, sıcak ve motive edici günün mesajını yaz.',
    facts.name ? `Kullanıcının adı: ${facts.name}. Adıyla hitap et.` : 'Kullanıcının adını bilmiyorsun, isim kullanma.',
    `Bugün kumbaraya atması önerilen tutar: ${money(facts.amount)}. Bu tutarı aynen yaz.`,
  ];
  if (facts.goal) {
    const g = facts.goal;
    lines.push(`Hedefi: ${g.name}. %${g.pct} tamamlandı, kalan ${money(g.left)}.${g.days > 0 ? ` Hedef tarihine ${g.days} gün var.` : ''} Hedefin adını geçir.`);
  } else lines.push('Henüz bir hedefi yok; birikime başlamaya teşvik et.');
  lines.push('Her gün farklı bir üslup kullan: bazen esprili, bazen ilham verici, bazen pratik bir ipucu. Tırnak işareti, başlık veya açıklama yazma; sadece mesajın kendisini yaz. En fazla bir emoji.');
  return lines.join('\n');
}

// Üretilen metin önerilen tutarı içermiyorsa güvenme
export function looksValid(text, amount) {
  if (!text || text.length < 15) return false;
  const digits = String(Math.round(amount));
  return text.replace(/\./g, '').includes(digits);
}
