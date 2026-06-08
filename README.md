# EFSANE-11

EFSANE-11, Turk futbolseverlerin kulup tarihindeki efsane oyunculardan kendi ruya 11'lerini kurabildigi, bu kadrolari turnuva simulasyonunda yaristirabildigi ve sosyal medya icin gorsel olarak disa aktarabildigi bir Next.js uygulamasidir.

## Vizyon

Referans noktamiz, 7o0.com.br'nin hizli ve kullanici dostu kadro kurma deneyimi. Farkimiz ise Turkiye futbol kulturune yaslanan oyunlastirma: Galatasaray, Fenerbahce, Besiktas, Trabzonspor, Milli Takim ve diger yerel hikayeler uzerinden efsane kadrolar kurmak, onlari turnuvada sahaya cikarmak ve paylasilabilir ciktilar uretmek.

## Mevcut Durum

- Next.js 16, React 19 ve Tailwind CSS 4 ile App Router tabanli frontend.
- Zustand ile kadro, formasyon, tema, zorluk ve draft akisi state yonetimi.
- Formasyon bazli saha yerlesimi: 4-4-2, 4-3-3, 4-2-3-1, 3-5-2 ve diger dizilisler.
- Tikla-sec/tikla-yerlestir akisiyle pozisyon uyumlulugu kontrol edilen oyuncu secimi.
- Turnuva modu: kullanici kadrosu, efsane Avrupa takimlariyla ceyrek finalden finale kadar simule ediliyor.
- `html-to-image` ile manset ve kadro gorseli indirme altyapisi.

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

- Genis oyuncu havuzu: kulup, donem, pozisyon, reyting ve efsane metadata alanlari.
- Kulup bazli filtreleme ve secim akisi.
- Gercek surukle-birak deneyimi icin dnd-kit entegrasyonunu UI akisiyle birlestirme.
- Instagram Story, X/Twitter ve kare formatlarda ayri export sablonlari.
- Daha zengin simulasyon modeli: mentalite, kimya, pozisyon uyumu ve oyuncu rolleri.
