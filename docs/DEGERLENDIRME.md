# FieldShift: gösterim ve doğrulama rehberi

## Jüriye anlatım (yaklaşık 90 saniye)

“Çiftçinin sorusu şu: Değişen iklimde, geçen yıl ektiğim üründen sonra hangi ürünü seçmeliyim? FieldShift, konumun iklim geçmişini ve çiftçinin su, toprak ve pazar önceliklerini açıklanabilir bir münavebe planına dönüştüren araştırma prototipidir.”

1. Konumu ve geçen yılın ürününü seçin. Canlı veri alınabiliyorsa kaynak durumlarını gösterin; sentetik örneğe geçerseniz bunu açıkça söyleyin.
2. Planın altında ürün sırasının nedenlerini gösterin. POWER sıcaklık ve yağışının uygunluğu; MODIS eğiliminin ek puanları nasıl etkilediğini açıklayın.
3. Mühendis görünümünde sıcaklığı +2 °C, yağışı −%20 yapın. Uygunluk ve plan puanındaki değişimi gösterin. Bu bir duyarlılık deneyi, gelecek tahmini değildir. Planın aynı kalması da geçerli bir sonuçtur.
4. “Tasarruf rakamları saha ölçümü değil, seçilen karşılaştırmaya ve varsayımlara bağlı hesaplamalardır. Sonraki adımımız yerel uzman değerlendirmesi ve tarla pilotudur.” diye bitirin.

## Tekrarlanabilir hesaplama örneği

`node tests/model.cjs` ile üretilmiştir. Konya enlemiyle oluşturulmuş **sentetik** iklim; 2016–2025 ortalaması, pH 7,9, kil %32, kıraç, önceki ürün buğday, üç yıllık plan ve eşit öncelikler kullanılır. Arayüzün NDVI/kuraklık ek ağırlıklarından bağımsız bir model kontrolüdür.

| Senaryo | Öneri | Plan puanı | Buğday uygunluğu |
|---|---|---:|---:|
| Mevcut örnek iklim | Nohut → Arpa → Aspir | 123 | 48/100 |
| +2 °C / yağış −%20 | Nohut → Arpa → Aspir | 94 | 24/100 |

Plan puanı bonus ve cezaları içerir, 100 ile sınırlı değildir; doğruluk yüzdesi veya kâr değildir. Aynı ürün sırası kalırken uygunluğun düşmesi, modelin iklim girdilerine tepki verdiğini gösterir. Gerçek dünyadaki başarısını kanıtlamaz.

## Bölgesel kontrol: gerçek NASA verisiyle (14 Kasım 2026)

`node tests/regions.cjs` sayfaya gömülü gerçek NASA POWER ve SoilGrids kayıtlarıyla dört bölgede modeli çalıştırır (önceki ürün buğday, üç yıl, eşit öncelikler). Noktalar SoilGrids verisi olan ve MODIS MCD12Q1 2025 arazi örtüsünde "tarım arazisi" (sınıf 12) görünen yerlerdir.

**Bu kontrol modelde bir hata yakaladı.** NASA POWER aylık `T2M_MAX` / `T2M_MIN` değerleri ayın en uç sıcaklığıdır; model eşikleri ise ortalama günlük en yüksek / en düşük sıcaklığa göre yazılmıştı (Konya temmuz: uç ~37 °C, günlük ortalama en yüksek ~31 °C). Ayrıca hazır noktalar şehir merkezlerindeydi ve SoilGrids üçünde boş döndü. Düzeltme: günlük POWER verisinin aylık ortalaması kullanılıyor; noktalar tarım arazisine taşındı.

| Bölge | Düzeltmeden önce (kıraç / sulu) | Düzeltmeden sonra, kıraç | Düzeltmeden sonra, sulu |
|---|---|---|---|
| Konya Ovası | Fiğ → Arpa → Fiğ | Nohut → Buğday → Kolza | Nohut → Buğday → Kolza |
| Çukurova | Nadas → Nadas → Nadas | Kırmızı mercimek → Aspir → Fiğ | Aspir → Kırmızı mercimek → Pamuk |
| Harran Ovası | Nadas → Nadas → Nadas | Kırmızı mercimek → Nadas → Fiğ | Kırmızı mercimek → Nadas → Fiğ |
| Trakya | Fiğ → Arpa → Fiğ | Nohut → Arpa → Aspir | Nohut → Arpa → Aspir |

Bölgedeki yaygın uygulama (uzmanla doldurulacak): Konya —, Çukurova —, Harran —, Trakya —.

**Açık sorun:** Sulu Harran'da pamuk veya mısır önerilmiyor; bölgenin sulu tarımıyla uyuşmuyor. Pamuk / mısır için ilkbahar soğuk eşikleri ve ekim takvimleri uzmanla gözden geçirilmeli. MODIS yeşillik verisi bu kontrole henüz dahil değil.

## Gerçek tarla pilotu kayıt şablonu — henüz tamamlanmadı

- Challenge başlığı ve bağlantısı: doldurulacak.
- Tarla / bölge, alan, toprak analizi tarihi ve kaynağı: doldurulacak.
- Önceki ürünler, ekim / hasat tarihleri, sulama kapasitesi: doldurulacak.
- Veri çekim tarihi, POWER dönemleri, MODIS kalite kontrolü: doldurulacak.
- Çiftçinin mevcut planı ve FieldShift önerisi: doldurulacak.
- Modelin öngördüğü su / gübre farkı ve kullanılan varsayımlar: doldurulacak.
- Uzmanın adı, değerlendirme tarihi, kabul ettiği ve değiştirdiği öneriler: doldurulacak.
- Sezon sonunda ölçülen su, gübre, verim, maliyet ve gelir: doldurulacak.
- Tahmin–ölçüm farkı ve hava / işletme koşullarının etkisi: doldurulacak.

Tek tarladaki sonuç genellenmemelidir. Pilot öncesi ürün eşikleri ve takvimleri yerel uzmanla kontrol edilmeli; başarı ölçütleri önceden belirlenmelidir.

## Kaynak ve kanıt durumu

- NASA POWER meteoroloji kaynakları: https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/
- FAO EcoCrop genel referansı: https://www.fao.org/land-water/resources/tools/databases/ecocrop/en
- Ürünlere ait sayısal eşikler, azot katkısı, su depolama dönüşümü ve sıralama katsayıları henüz kaynak bazında doğrulanmadı. Genel kaynak bağlantıları bu katsayıları doğrulanmış yapmaz.
- Canlı API erişimi, tarayıcı görünümü ve saha başarısı bu hesaplama testi kapsamında değildir.
