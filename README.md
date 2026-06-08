# EFSANE-11

EFSANE-11, Turk futbolseverlerin kulup tarihindeki efsane oyunculardan kendi ruya 11'lerini kurabildigi, kaptanini secip turnuvaya sokabildigi ve sosyal medya icin kadro gorseli uretebildigi bir Next.js oyunudur.

## Canli Demo

[efsane-11.vercel.app](https://efsane-11.vercel.app/)

## Vizyon

Referans noktamiz, 7o0.com.br'nin hizli ve kullanici dostu kadro kurma deneyimi. Farkimiz ise Turkiye futbol kulturune yaslanan oyunlastirma: Galatasaray, Fenerbahce, Besiktas, Trabzonspor, Milli Takim ve diger yerel hikayeler uzerinden efsane kadrolar kurmak, onlari turnuvada sahaya cikarmak ve paylasilabilir ciktilar uretmek.

## Ozellikler

- 7a0.com.br tarzinda hizli kadro kurma akisi.
- Kadro adi, dizilis, zihniyet ve zorluk secimi.
- Pozisyon uyumlu tikla-sec/tikla-yerlestir oyuncu draft sistemi.
- 11/11 tamamlaninca roll akisi kapanir ve buyuk kaptan secimi ekrani acilir.
- Kaptan secimi zorunludur; kaptan liderlik bonusu verir.
- Turnuva modu: ceyrek finalden finale kadar canli skor, istatistik ve mac raporu.
- Normal, Hizli ve Hiper simulasyon hizlari.
- Paylasim linki, Story PNG ve kare kadro gorseli export'u.
- Yerel istatistik paneli: en cok secilen efsaneler.

## Teknolojiler

- Next.js 16
- React 19
- Tailwind CSS 4
- Zustand
- lucide-react
- html-to-image

## Gelistirme

```bash
npm install
npm run dev
```

Uygulama varsayilan olarak `http://localhost:3000` adresinde calisir.

## Kontroller

```bash
npm run lint
npm run build
```

## Yol Haritasi

- Daha genis oyuncu ve sezon havuzu.
- Takim logolari ve oyuncu gorselleri.
- Kimya sistemi: ayni takim, ayni donem ve pozisyon uyumu bonuslari.
- Daha zengin mac olaylari: penalti, kirmizi kart, son dakika golu.
- Ozel domain ve paylasim sayfasi.
