# ARGIS

**Canlı:** https://argis-mu.vercel.app/ (Vercel) · https://kivanc-orcun-erbay.github.io/argis/ (GitHub Pages)

Vercel'e yeniden yüklemek için: `npx vercel@65.8.0 deploy --prod` (`vercel.json` ve `.vercelignore` yalnızca statik sayfayı yükler).

**Sorun.** İklim kayarken çiftçi, geçen yıl ektiği üründen sonra ne ekeceğine çoğunlukla alışkanlıkla karar veriyor. Kıraçta buğday–nadas, sulu tarlada aynı ürün üst üste; su ve toprak tükeniyor.

**Çözüm.** Argis, tarlanın 2001'den bugüne NASA POWER iklimini, MODIS yeşillik eğilimini ve SoilGrids toprağını okuyup açıklanabilir bir münavebe planı çıkarır. Aynı tarla için 20 yıl önceki iklimle ne önerilirdi, bugün ne öneriliyor, yan yana gösterir. Her gerekçenin hangi NASA verisinden geldiği yazar.

NASA iklim verileriyle açıklanabilir münavebe planı üreten araştırma prototipi.

`index.html` dosyasıyla açılır. Canlı veri ve harita servisleri internet gerektirir. Hazır dört bölge (Konya, Çukurova, Harran, Trakya) sayfaya gömülü gerçek NASA verisiyle açılır; sentetik örnek ayrı bir bağlantıdadır.

Sayfa Türkçe ve İngilizcedir: sağ üstteki **TR / EN** düğmesiyle dil değişir ve seçim hatırlanır. `?lang=en` ile doğrudan İngilizce açılır (ör. https://argis-mu.vercel.app/?lang=en).

**Mevcut planımla karşılaştır** bölümünde 2–4 yıllık planını girip koruyacağın ekimleri seçebilirsin. Tek değişiklik önerisi sırasıyla uygunluk kontrolünü geçemeyen ürünleri, aile tekrarlarını, sulu tarlada en yüksek sezonluk sulamayı ve ana ürünsüz ayları karşılaştırır.

**Mühendis → Plan kısıtları ve kurak yıl** bölümünde başlangıç ayı, ilk hasat için son ay ve sulu tarlada sezonluk net sulama kotası seçilebilir. Nadas takvimde 12 ay sürer. Kota ve hasat sınırı puanlamadan önce uygulanır. Kurak yıl seçeneği, öneriyi seçilen tarlanın kayıtlardaki en düşük yağışlı tam iklim yılıyla sınar. **Yöntem** altında Konya nohut ve Haymana buğday denemelerinin saha sonuçları Argis hesaplarıyla gösterilir.

**Veri kontrolleri** bölümü her hesapta planın dayandığı veriyi denetler: güncellik, eksik değer, fiziksel sınırlar, ani sıçramalar, günlük sıcaklık, MODIS ve toprak verisinin varlığı. NASA POWER yağış ve sıcaklığı ikinci bir kaynakla (ERA5, Open-Meteo arşivi) karşılaştırılır; yağış farkı %25'i ya da sıcaklık farkı 2 °C'yi aşarsa uyarı verilir. Konya için POWER yağışı ERA5'ten belirgin biçimde yüksektir (2016–2025: yılda 515 / 307 mm).

## Kontrol

```sh
node tests/model.cjs
node --test tests/unit.cjs
node tests/regions.cjs
```

Ek paket gerektirmez; her push'ta GitHub Actions'ta da çalışır.

- `model.cjs`: sayfa betikleri ve veri bloğu, eksik toprak verisinin puan aralığı, toprak analizi (kireç, tuzluluk) etkisi.
- `unit.cjs`: model fonksiyonları (iklim örüntüsü istatistikleri dahil: Mann-Kendall, Sen eğimi, SPI). Eşik eğrileri, hasat ayının sıcaklık stresine sayılmaması, yağış / tuz / kireç / ısınma yönünde tutarlılık, plan kuralları, günlük sıcaklık ortalaması, MODIS kalite süzgeci.
- `regions.cjs`: dört bölgenin gerçek verisiyle akla yatkınlık kuralları (ör. sulu tarlada en fazla 1 yıl nadas, kıraç planda sulama isteyen ürün yok, sulu Harran ve Çukurova'da pamuk uygunluğu ≥ 60) ve `tests/regions.golden.json` kaydı. Planlar veya uygunluk puanları değişirse test kırılır; değişiklik bilerek yapıldıysa gözden geçirip `node tests/regions.cjs --update` ile kaydı güncelleyin.

### Tarayıcı testleri

```sh
npm ci
npx playwright install chromium
npx playwright test
```

Playwright ve axe ile 20 test (`tests/browser/`). Dış servisler (NASA POWER, SoilGrids, MODIS, harita karoları) `data/raw/` verisinden taklit edilir; testler bu servislerin ayakta olmasına bağlı değildir ve her biri bilerek bozulabilir.

- `main.spec.cjs`: sayfa Konya'nın gerçek verisiyle açılır; her hazır bölge (kıraç ve sulu) `regions.golden.json` kaydındaki planı gösterir; sıcak/kurak senaryo düğmesi; toprak analizi (EC) tuza hassas ürünleri düşürür; çiftçi / mühendis görünümü; harita tıklamasında TKGM kartı; konsol hatası yok.
- `failures.spec.cjs`: “Münavebe planımı çıkar” tüm servisler çalışırken; yükleme durumu; POWER, günlük sıcaklık, MODIS veya SoilGrids çökünce sayfanın ne yaptığı ve ne yazdığı.
- `quality.spec.cjs`: 375 px telefon ekranında yatay kaydırma yok, karanlık mod, azaltılmış hareket, axe erişilebilirlik taraması (ciddi / kritik ihlal yok).

GitHub Actions her push'ta hem Node testlerini hem tarayıcı testlerini çalıştırır.

## Veri

Hazır bölgelerin verisi `data/raw/` klasöründedir; sayfaya gömülü olan da budur.

| Dosya | Kaynak | İçerik |
|---|---|---|
| `<bölge>_power.json` | NASA POWER | 2001–2025 aylık iklim; en yüksek / en düşük sıcaklık günlük verinin aylık ortalamasıdır |
| `<bölge>_soil.json` | SoilGrids 2.0 (ISRIC) | pH, kil, organik karbon (0–30 cm ortalaması) |
| `<bölge>_ndvi.json` | MODIS MOD13Q1 (ORNL DAAC) | Son ~5 yıl (115 tarih) NDVI ve piksel güvenilirlik bayrağı; dört bölge için de var |

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
