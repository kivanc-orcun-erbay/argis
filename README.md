# FieldShift

**Canlı:** https://kivanc-orcun-erbay.github.io/fieldshift/

**Sorun.** İklim kayarken çiftçi, geçen yıl ektiği üründen sonra ne ekeceğine çoğunlukla alışkanlıkla karar veriyor. Kıraçta buğday–nadas, sulu tarlada aynı ürün üst üste; su ve toprak tükeniyor.

**Çözüm.** FieldShift, tarlanın 2001'den bugüne NASA POWER iklimini, MODIS yeşillik eğilimini ve SoilGrids toprağını okuyup açıklanabilir bir münavebe planı çıkarır. Aynı tarla için 20 yıl önceki iklimle ne önerilirdi, bugün ne öneriliyor, yan yana gösterir. Her gerekçenin hangi NASA verisinden geldiği yazar.

NASA iklim verileriyle açıklanabilir münavebe planı üreten araştırma prototipi.

`index.html` dosyasıyla açılır. Canlı veri ve harita servisleri internet gerektirir. Örnek tarla sentetik veri kullanır.

## Kontrol

```sh
node tests/model.cjs
```

Ek paket gerektirmez. JavaScript sözdizimini, eksik toprak verisinin belirsizlik aralığını ve iki iklim senaryosunda plan üretimini kontrol eder.

Jüri gösterimi, tekrarlanabilir örnek ve henüz tamamlanmamış saha pilotu şablonu: [Değerlendirme rehberi](docs/DEGERLENDIRME.md).

Sonuçlar saha doğrulaması yapılmış tarımsal tavsiye veya kâr tahmini değildir. Yöntem, veri sınırları ve varsayımlar uygulamada açıklanır.
