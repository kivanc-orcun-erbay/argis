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
| Mevcut örnek iklim | Nohut → Arpa → Aspir | 128 | 50/100 |
| +2 °C / yağış −%20 | Nohut → Arpa → Aspir | 96 | 28/100 |

Plan puanı bonus ve cezaları içerir, 100 ile sınırlı değildir; doğruluk yüzdesi veya kâr değildir. Aynı ürün sırası kalırken uygunluğun düşmesi, modelin iklim girdilerine tepki verdiğini gösterir. Gerçek dünyadaki başarısını kanıtlamaz.

## Bölgesel kontrol: gerçek NASA verisiyle (14 Kasım 2026)

`node tests/regions.cjs` sayfaya gömülü gerçek NASA POWER ve SoilGrids kayıtlarıyla dört bölgede modeli çalıştırır (önceki ürün buğday, üç yıl, eşit öncelikler). Noktalar SoilGrids verisi olan ve MODIS MCD12Q1 2025 arazi örtüsünde "tarım arazisi" (sınıf 12) görünen yerlerdir.

**Bu kontrol modelde bir hata yakaladı.** NASA POWER aylık `T2M_MAX` / `T2M_MIN` değerleri ayın en uç sıcaklığıdır; model eşikleri ise ortalama günlük en yüksek / en düşük sıcaklığa göre yazılmıştı (Konya temmuz: uç ~37 °C, günlük ortalama en yüksek ~31 °C). Ayrıca hazır noktalar şehir merkezlerindeydi ve SoilGrids üçünde boş döndü. Düzeltme: günlük POWER verisinin aylık ortalaması kullanılıyor; noktalar tarım arazisine taşındı.

| Bölge | Düzeltmeden önce (kıraç / sulu) | Şimdi, kıraç | Şimdi, sulu |
|---|---|---|---|
| Konya Ovası | Fiğ → Arpa → Fiğ | Nohut → Buğday → Kolza | Nohut → Buğday → Kolza |
| Çukurova | Nadas → Nadas → Nadas | Nohut → Arpa → Kırmızı mercimek | Nohut → Mısır → Kırmızı mercimek |
| Harran Ovası | Nadas → Nadas → Nadas | Kırmızı mercimek → Buğday → Fiğ | Fiğ → Mısır → Kırmızı mercimek |
| Trakya | Fiğ → Arpa → Fiğ | Nohut → Buğday → Aspir | Nohut → Buğday → Aspir |

Bölgedeki yaygın uygulama (uzmanla doldurulacak): Konya —, Çukurova —, Harran —, Trakya —.

**İkinci düzeltme — sulu Harran'da pamuk.** İlk düzeltmeden sonra pamuk sulu Harran'da hâlâ elenmişti (uygunluk 26/100). Nedenler ve yapılan değişiklikler:

- Sıcaklık stresi hasat ayı dahil hesaplanıyordu; olgunlaşmış ürün için anlamsız. Artık hasat ayı hariç büyüme aylarına bakılır (buğday / arpa için haziran yerine mayıs başak dolumu). Sulu Harran'da buğday uygunluğu 27 → 69.
- Pamuk sezonu nisanda başlıyordu; Harran'da ekim nisan sonu–mayıstır. Sezon mayıs–ekim yapıldı.
- Pamuk (35–41 °C) ve mısır (34–39 °C) sıcaklık eşikleri, temmuz–ağustos ortalama günlük en yüksek sıcaklığı ~41 °C olan sulu ovalar için fazla dardı; pamuk 38–46 °C, mısır 36–44 °C yapıldı.

Sonuç: sulu Harran'da pamuk uygunluğu 26 → 74/100, mısır 29 → 56/100. Dengeli hedefte plan **Fiğ → Mısır → Kırmızı mercimek** olur; pamuk planı (ör. Pamuk → Kırmızı mercimek → Buğday) münavebe kurallarında geride kalır: mısır bakliyattan sonra azot kredisi (+10) ve hububat kırılımı (+6) alır, pamuk hasadı ile mercimek ekimi arasında bir ay kalır (−5). Çiftçi pamuğun kazanç puanını 5 yapıp "Pazar önceliği"ni seçerse pamuklu planlar 2. ve 3. seçenek olur (123 puan, birinciye 1 puan yakın).

**Hâlâ açık:** Yeni sıcaklık eşikleri ve pamuk takvimi tek bir bölgeye bakılarak ayarlandı; uzman doğrulaması gerekir. Mısırın sıcakta tozlanma riski bu eşiklerle hafife alınmış olabilir. MODIS yeşillik verisi yalnızca Konya için var (servis yanıt vermedi).

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
