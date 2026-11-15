# Performans ölçümü — 14 Kasım 2026

İlk ölçüm `16db48f` sürümünde yapıldı; aşağıdaki iyileştirmelerden sonra `89e317c` sürümünde tekrarlandı (bkz. “İyileştirmelerden sonra”). İlk ölçüm sürümü: `16db48f` (canlı site, https://kivanc-orcun-erbay.github.io/fieldshift/). Makine: Apple M4 Pro, Chromium 156, Node 25. Telefon profili: CPU 4× yavaş, "yavaş 4G" (1,6 Mbit/s indirme, 150 ms gecikme), 375 px ekran.

Yeniden çalıştırmak için:

```sh
node tests/bench/model.cjs          # model hızı (Node)
node tests/bench/page.cjs           # sayfa yükleme ve etkileşim (canlı site, tarayıcı)
node tests/bench/services.cjs       # dış veri servisleri (hafif, sıralı)
```

## Özet

| Ne | Masaüstü | Telefon | Değerlendirme |
|---|---:|---:|---|
| İlk plan ekranda | 1,4 s | 2,3 s | İyi; 0,35 s'si gereksiz bir bekleme |
| Sayfa boyutu (HTML + gömülü veri) | 62 KB | 62 KB | İyi |
| Hazır bölge / sulama / senaryo değişimi | 11–21 ms | 35–41 ms | Anında |
| 4 yıllık plana geçiş | 65 ms | **233 ms** | Telefonda 200 ms'yi aşıyor |
| “Münavebe planımı çıkar” (canlı veri) | **15,7 s** | — | Plan 2,4 s'de hazır olabilirdi; MODIS bekleniyor |

## 1. Sayfa yükleme (soğuk önbellek, 7 deneme, medyan (p95), ms)

| Profil | TTFB | DOM hazır | load | LCP | İlk plan | HTML KB | İstek |
|---|---:|---:|---:|---:|---:|---:|---:|
| Masaüstü | 271 (486) | 641 (888) | 1347 (1931) | 1184 (1400) | 1363 (1951) | 62 | 30 |
| Telefon | 269 (348) | 979 (1038) | 2314 (2362) | 2292 (2356) | 2336 (2402) | 62 | 11 |

- HTML 62 KB'tır; bunun ~58 KB'ı dört bölgenin gömülü NASA verisidir. Leaflet (cdnjs), yazı tipleri ve harita karoları ayrıca yüklenir. Başka sitelerden gelen dosyaların boyutu tarayıcıya bildirilmediği için toplam boyut ölçülemedi.
- İlk plan, sayfa yüklendikten sonra sabit 350 ms beklenerek çiziliyor (`setTimeout(…, 350)`). Bu bekleme gereksiz.

## 2. Etkileşim gecikmesi (olaydan sonraki ilk çizime kadar, ms)

| Profil | Bölge seçimi | Sulama | +2 °C senaryo | 3 → 4 yıl | 4 → 3 yıl | Mühendis görünümü |
|---|---:|---:|---:|---:|---:|---:|
| Masaüstü | 21 | 14 | 11 | 65 | 14 | 29 |
| Telefon | 41 | 36 | 35 | **233** | 32 | 70 |

Google'ın INP ölçütüne göre 200 ms altı "iyi" sayılır. 4 yıllık plan dışındaki her şey telefonda da bunun çok altında.

## 3. Model hızı (Node, 50 tekrar, medyan / p95)

| Bölge | Veri + iklim (25 yıl) | 13 ürün puanı | Plan 2 yıl | Plan 3 yıl | Plan 4 yıl | Tam yeniden hesap (3 yıl) |
|---|---:|---:|---:|---:|---:|---:|
| Konya | 0,83 / 0,99 ms | 0,10 / 0,15 ms | 0,18 / 0,26 ms | 2,5 / 3,0 ms | 45 / 56 ms | 6,1 / 6,5 ms |
| Çukurova | 0,79 / 0,99 ms | 0,08 / 0,11 ms | 0,11 / 0,14 ms | 1,3 / 1,7 ms | 17 / 18 ms | 3,8 / 4,1 ms |
| Harran | 0,79 / 0,92 ms | 0,08 / 0,10 ms | 0,07 / 0,09 ms | 0,65 / 0,83 ms | 6,6 / 7,2 ms | 2,4 / 2,6 ms |
| Trakya | 0,78 / 0,89 ms | 0,08 / 0,09 ms | 0,18 / 0,23 ms | 3,0 / 3,5 ms | 59 / 72 ms | 7,3 / 7,9 ms |

Plan araması tüm ürün dizilerini dener; uygun ürün sayısı *n* ise *n*ʸ dizi vardır. Her ek yıl süreyi ~10–20 kat artırır. Uygun ürünü çok olan bölgelerde (Konya, Trakya) 4 yıllık plan en yavaş durumdur.

## 4. Dış veri servisleri (3 sıralı istek, aralarında 2 s; yük testi değildir)

| Servis | Medyan | En kısa | En uzun | Boyut | Hata |
|---|---:|---:|---:|---:|---:|
| NASA POWER aylık (2001–2025) | 1,1 s | 1,1 s | 1,4 s | 33 KB | 0 |
| NASA POWER günlük en yüksek / en düşük | 1,3 s | 1,3 s | 1,4 s | 297 KB | 0 |
| SoilGrids 2.0 | 3,3 s | 3,1 s | 17,6 s | 1 KB | 0 |
| MODIS tarih listesi (ORNL) | 48 s | 37 s | 54 s | 35 KB | 0 |
| MODIS tek parça (10 tarih) | 55 s | 54 s | 55 s | 2 KB | 1 (HTTP 502) |

Canlı sitede tek bir “Münavebe planımı çıkar” tıklaması: NASA POWER 1,3 s'de, SoilGrids 2,4 s'de geldi; plan **15,7 s'de** göründü ve MODIS olmadan hesaplandı. Sayfa üç servisi de beklediği için kullanıcı, zaten başarısız olacak MODIS'i bekliyor. MODIS için sayfa ~24 istek atar ve her birine 25 s süre tanır; servis bugünkü hızıyla bu sürede yanıt veremiyor.

## Yük (eşzamanlı kullanıcı)

Ayrı bir yük testi yapılmadı, çünkü Argis'in sunucusu yoktur: sayfa GitHub Pages'in CDN'inden gelen tek bir statik dosyadır ve her kullanıcının tarayıcısı NASA / ISRIC / ORNL servislerine doğrudan bağlanır. Kullanıcı sayısı arttıkça yük bu kurumların servislerine dağılır. Onlara toplu istek göndermek hem uygunsuz hem de ölçmek istediğimiz şey değildir. Hazır dört bölge hiçbir dış servise gitmeden, sayfaya gömülü veriyle çalışır; jüri gösterimi servis yükünden etkilenmez.

## İyileştirmelerden sonra (`89e317c`)

| Ne | Önce | Sonra |
|---|---:|---:|
| “Münavebe planımı çıkar”, plan ekranda (canlı) | 15,7 s ve 25 s | **3,1 s** (SoilGrids hızlıyken) / **5,1 s** (SoilGrids yavaşken) |
| İlk plan, masaüstü | sayfa `load`'undan sonra (~1,4 s) | **0,87 s** (HTML gelir gelmez) |
| İlk plan, telefon | ~2,3 s | **1,06 s** |
| 4 yıllık plana geçiş, telefon | 233 ms | **103 ms** |
| 4 yıllık plan araması (Node, en yavaş bölge) | 59 ms | 16 ms |

Yapılanlar:

1. **Plan, yavaş servisleri beklemiyor.** NASA POWER gelince (~1,5–2 s) plan, SoilGrids'i en çok 5 s bekler. Gelmezse toprak verisi olmadan çizilir (toprağa bağlı puanlar aralık olarak gösterilir). MODIS hiç beklenmez. İkisi de arka planda yüklenmeye devam eder (SoilGrids için 60 s, MODIS için istek başına 90 s); gelince plan yeniden hesaplanır ve kısa bir bildirim çıkar. Durum satırı neyin beklendiğini yazar. Bu arada başka bir konum veya hazır bölge seçilirse eski yanıtlar yok sayılır. Canlı denemede MODIS 143 s sonra hata verdi; plan o sırada zaten ekrandaydı.
2. **4 yıllık plan araması budandı.** Arama 12.000 diziyi aşacaksa (pratikte yalnızca 4 yıllık planlar) en uygun 9 ürün + nadas ile yapılır. 4 bölge × kıraç/sulu × 3 hedef (24 durum) için ilk üç seçenek tam aramayla birebir aynı. Daha sıkı bir sınır (8 ürün) Trakya'da ayçiçeğini dışarıda bırakıp 3 durumda sonucu değiştirdiği için kullanılmadı. 2 ve 3 yıllık planlar budanmaz. 4 yıllık planlar artık `tests/regions.golden.json` kaydında.
3. **Açılıştaki 350 ms bekleme kaldırıldı.** Kayıtlı Konya planı sayfa betiği çalışır çalışmaz çizilir.

Ölçüm notu: İlk ölçümde “ilk plan” süresi sayfanın `load` olayı beklendikten sonra okunuyordu, bu yüzden hiçbir zaman `load` süresinden kısa çıkamıyordu. `page.cjs` artık planın yazıldığı anı sayfanın içinde kaydediyor. Önceki tablolardaki “İlk plan” sütunu bu yüzden olduğundan uzun görünür.

Testler: “yavaş SoilGrids”, “yavaş MODIS” ve “geç gelen yanıt yeni seçimi bozmaz” tarayıcı testleri eklendi (toplam 23).
