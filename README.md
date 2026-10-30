# Cüzdanım v1.0

Kişisel finans uygulaması (React + Vite, PWA). v1'de veriler telefonun kendi hafızasında tutulur.

## Ekranlar
- **Ana ekran:** bakiye, aylık bütçe, günün motivasyon mesajı, 6 kutu, son işlemler
- **Harcamalarım:** kategori limitleri, aşım uyarısı, aylık işlemler
- **Faturalarım / Ödemelerim:** tekrarlayan kayıtlar, "Ödendi" işaretleme (tutar bakiyeden düşer)
- **Birikimlerim:** gram/çeyrek altın, dolar, euro, TL; günlük kur, kâr/zarar
- **Hedeflerim:** kumbara animasyonu, %25/50/75/100 kutlamaları, seviyeler
- **Borçlarım:** borç/alacak, "Ödeme yaptım" / "Borç arttı", geçmiş
- **Ayarlar:** bakiye eşitleme, PIN kilidi, yedek (JSON), Excel (CSV) dışa aktarma

## Windows'ta çalıştırma
1. Node.js LTS kur: https://nodejs.org (kurulumdan sonra bilgisayarı yeniden başlat)
2. Bu klasörde adres çubuğuna `cmd` yazıp Enter'a bas, sonra:
   ```
   npm install
   npm run dev
   ```
3. Bilgisayarda: http://localhost:5173

## iPhone'da deneme (aynı Wi-Fi)
1. `npm run dev` çıktısındaki **Network** adresini (ör. `http://192.168.1.25:5173`) iPhone Safari'de aç.
2. Windows güvenlik duvarı sorarsa "İzin ver" de.

Bu deneme içindir. Bilgisayar kapanınca uygulama açılmaz.

## iPhone'a kalıcı kurulum (ücretsiz)
1. `npm run build` çalıştır, `dist` klasörü oluşur.
2. https://app.netlify.com/drop adresine `dist` klasörünü sürükle-bırak (ücretsiz hesap).
3. Verilen https adresini iPhone Safari'de aç → Paylaş → **Ana Ekrana Ekle**.

Güncelleme yaparken yine `npm run build` ve aynı Netlify sitesine yeni `dist` yükle. Adres değişirse veriler görünmez, bu yüzden aynı siteyi kullan ve **Ayarlar → Yedek indir** ile düzenli yedek al.

## Notlar
- Kurlar: fawazahmed0/currency-api (ücretsiz, günlük). Altın ons fiyatından hesaplanır; kuyumcu fiyatı için Birikimlerim → Kurlar'dan elle düzelt.
- PIN kilidi meraklı gözler içindir, veriyi şifrelemez.
- Sonraki sürümler: Google Sheets senkronu, ekstre içe aktarma, grafikler, SMS otomasyonu.
