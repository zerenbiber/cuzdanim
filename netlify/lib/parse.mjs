// Doğal dildeki kayıtları ("Migros'ta 250 harcadım, maaş yattı 25 bin") yapılandırılmış işlemlere çevirir.
import { aiJSON } from './ai.mjs';

export const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: ['gelir', 'gider'] },
          amount: { type: 'NUMBER' },
          category: { type: 'STRING' },
          note: { type: 'STRING' },
          date: { type: 'STRING' },
        },
        required: ['type', 'amount', 'category', 'note', 'date'],
      },
    },
  },
  required: ['items'],
};

export function parsePrompt(text, cats, incomes, today) {
  return [
    'Sen bir kişisel finans uygulamasının kayıt asistanısın. Kullanıcının Türkçe yazdığı cümleyi gelir/gider kayıtlarına çevir.',
    `Bugünün tarihi: ${today}. "dün", "geçen cuma" gibi ifadeleri buna göre YYYY-MM-DD tarihine çevir; tarih yoksa bugünü kullan.`,
    `Gider kategorileri (sadece bunlardan biri): ${cats.join(', ')}.`,
    `Gelir türleri (gelirde category bunlardan biri): ${incomes.join(', ')}.`,
    'Kurallar:',
    '- Tutarı TL olarak sayı yaz. "2 bin" = 2000, "1,5 bin" = 1500, "250,50" = 250.5, "yüz elli" = 150.',
    '- Harcama, ödeme, aldım, verdim → gider. Maaş, burs, harçlık, yattı, geldi, kazandım → gelir.',
    '- note: kısa açıklama, mağaza veya ürün adı (ör. "Migros", "Kahve"). Yoksa kategori adını yaz.',
    '- Bir cümlede birden fazla kayıt varsa hepsini ayrı item yap (en fazla 8).',
    '- Tutar yoksa o kaydı hiç ekleme.',
    `Kullanıcının cümlesi: """${text}"""`,
  ].join('\n');
}

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// Yapay zeka çıktısını güvenli hale getir
export function normalize(raw, cats, incomes, today) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return items
    .slice(0, 8)
    .map((it) => {
      const type = it?.type === 'gelir' ? 'gelir' : 'gider';
      const list = type === 'gelir' ? incomes : cats;
      const match = list.find((c) => c.toLocaleLowerCase('tr-TR') === String(it?.category || '').toLocaleLowerCase('tr-TR'));
      return {
        type,
        amount: Math.round(Math.abs(Number(it?.amount) || 0) * 100) / 100,
        category: match || (list.includes('Diğer') ? 'Diğer' : list[0]),
        note: String(it?.note || '').slice(0, 60).trim(),
        date: isDate(it?.date) && it.date <= today ? it.date : today,
      };
    })
    .filter((it) => it.amount > 0 && it.amount < 1e8);
}

export async function parseEntries(text, cats, incomes, today) {
  const raw = await aiJSON(parsePrompt(text, cats, incomes, today), SCHEMA);
  return raw ? normalize(raw, cats, incomes, today) : null;
}
