# FieldShift

**Canlı:** https://kivanc-orcun-erbay.github.io/fieldshift/

**Sorun.** İklim kayarken çiftçi, geçen yıl ektiği üründen sonra ne ekeceğine çoğunlukla alışkanlıkla karar veriyor. Kıraçta buğday–nadas, sulu tarlada aynı ürün üst üste; su ve toprak tükeniyor.

**Çözüm.** FieldShift, tarlanın 2001'den bugüne NASA POWER iklimini, MODIS yeşillik eğilimini ve SoilGrids toprağını okuyup açıklanabilir bir münavebe planı çıkarır. Aynı tarla için 20 yıl önceki iklimle ne önerilirdi, bugün ne öneriliyor, yan yana gösterir. Her gerekçenin hangi NASA verisinden geldiği yazar.

NASA iklim verileriyle açıklanabilir münavebe planı üreten araştırma prototipi.

`index.html` dosyasıyla açılır. Canlı veri ve harita servisleri internet gerektirir. Hazır dört bölge (Konya, Çukurova, Harran, Trakya) sayfaya gömülü gerçek NASA verisiyle açılır; sentetik örnek ayrı bir bağlantıdadır.

## Kontrol

```sh
node tests/model.cjs
node tests/regions.cjs
```

Ek paket gerektirmez. `model.cjs` JavaScript sözdizimini, eksik toprak verisinin belirsizlik aralığını, toprak analizi (kireç, tuzluluk) etkisini ve iki iklim senaryosunda plan üretimini kontrol eder. `regions.cjs` modeli dört bölgenin gerçek verisiyle çalıştırıp planları tablo olarak yazar.

## Veri

Hazır bölgelerin verisi `data/raw/` klasöründedir; sayfaya gömülü olan da budur.

| Dosya | Kaynak | İçerik |
|---|---|---|
| `<bölge>_power.json` | NASA POWER | 2001–2025 aylık iklim; en yüksek / en düşük sıcaklık günlük verinin aylık ortalamasıdır |
| `<bölge>_soil.json` | SoilGrids 2.0 (ISRIC) | pH, kil, organik karbon (0–30 cm ortalaması) |
| `<bölge>_ndvi.json` | MODIS MOD13Q1 (ORNL DAAC) | Son ~5 yıl NDVI ve piksel güvenilirlik bayrağı. Şu an yalnızca Konya var; servis diğer bölgelerde yanıt vermedi |

Noktalar tarım arazisidir: her birinde SoilGrids verisi vardır ve MODIS MCD12Q1 2025 arazi örtüsü sınıf 12'dir (tarım).

Veriyi yenilemek veya eksikleri tamamlamak için (API anahtarı gerekmez):

```sh
python3 scripts/fetch_snapshots.py      # eksik parçaları indirir, data/snapshots.json oluşturur
python3 scripts/embed_snapshots.py      # data/snapshots.json'u index.html'e gömer
node tests/model.cjs && node tests/regions.cjs
```

İndirilen her parça `data/raw/` içinde saklanır; kesilen indirme kaldığı yerden devam eder. Bir dosyayı silerseniz yeniden indirilir.

Jüri gösterimi, tekrarlanabilir örnek ve henüz tamamlanmamış saha pilotu şablonu: [Değerlendirme rehberi](docs/DEGERLENDIRME.md).

Sonuçlar saha doğrulaması yapılmış tarımsal tavsiye veya kâr tahmini değildir. Yöntem, veri sınırları ve varsayımlar uygulamada açıklanır.
