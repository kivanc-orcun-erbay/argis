# Kontrol sonuçları — 14 Kasım 2026

## Tarayıcı ve canlı servisler

GitHub Pages sürümünde Konya Ovası için “Münavebe planımı çıkar” çalıştırıldı. NASA POWER verileriyle 2001–2025 grafikleri ve plan oluştu. Ekranda son dönem yağışı 351 mm, ilk dönem yağışı 403 mm görüldü. Bu değerler uygulamanın çıktısıdır; bağımsız tarla ölçümü değildir.

MODIS yeşillik verisi bu denemede alınamadı. SoilGrids isteği sonrasında pH / kil boş kaldı. Canlı veri entegrasyonunun tamamı başarılı sayılmadı. Harita görüntüsü yüklendi; çiftçi / mühendis geçişi ve sentetik plan akışı çalıştı.

Yerel sürüm http://127.0.0.1:8765 üzerinden kontrol edildi. pH ve kil temizlenerek eksik veri akışı denendi: puan aralıkları ve “13 ürün değerlendirildi; 13 üründe toprak verisi eksik” başlığı görüldü. Görsel kayıt: browser-check.jpg. Görsel kontrol mevcut dar tarayıcı panelinde yapıldı; kapsamlı cihaz testi değildir.

## Bu kontrol sırasında düzeltilenler

- Başarılı HTTP yanıtına rağmen boş toprak / NDVI verisi artık eksik kaynak mesajına dahil edilir.
- Eksik toprak nedeniyle kesin uygunluk verilemeyen ürünler “0 ürün uyuyor” diye özetlenmez.

Düzeltmeler yerel çalışma dosyasındadır; bu çalışmada yayınlama yapılmadı.

## Otomatik kontroller

- node tests/model.cjs: geçti. JavaScript sözdizimi, eksik toprak puan sınırları ve iki senaryoda plan üretimi.
- git diff --check: geçti.
- node tests/regions.cjs: başarısız. Kontrol anında snapData boştu; dört bölgesel kayıt beklentisi karşılanmadı. Bu test kaldırılmadı veya başarıya zorlanmadı. Gerçek kaynaklardan kayıtlar oluşturulup yeniden çalıştırılmalı.

## Açık doğrulamalar

Gerçek tarla ölçümü, sezon sonu su / gübre / verim kayıtları ve ziraat mühendisi değerlendirmesi çalışma klasöründe bulunmadı. Bunlar olmadan saha doğrulaması tamamlanamaz. DEGERLENDIRME.md içindeki pilot şablonu kullanılabilir. MODIS ve SoilGrids veri erişimi yeniden doğrulanmalıdır.

## Güncelleme — 14.11.2026 15:11

- `node tests/regions.cjs`: geçti. Dört bölgenin gerçek NASA POWER ve SoilGrids kayıtları sayfaya gömüldü; sonuçlar DEGERLENDIRME.md içinde. MODIS yeşillik kayıtları henüz eklenmedi.

## Güncelleme — 14.11.2026 16:41

- MODIS NDVI verisi dört bölge için de indirildi ve sayfaya gömüldü. `node tests/model.cjs`, `node --test tests/unit.cjs` ve `node tests/regions.cjs` geçti; bölgesel kayıt değişmedi.
