# Paket 42 — Online XOX ızgara çeşitliliği simülasyonu

Kerem: *"xox online'da hep aynı takımlar geliyor. eşleşme profili hiç işe yaramıyor. çok çeşitli ve ayarlanabilir olmalı. çok sayıda simülasyon yapıp dediğim durumu incele."*

Her satır 300 ızgara üretiminin ölçümüdür. Ölçümün betiği t42/sim42.mjs; aynı ölçümler t57 testinde de kontrol ediliyor.

## Önce (eski üretici)

| Durum | Farklı kulüp | 300'de farklı ızgara | En sık kulüp | Art arda 2 maçta ortak kulüp |
|---|---|---|---|---|
| Dereceli (Dengeli, zorluk 4) | 36 | 172 | Galatasaray %62 | 2,0 / 6 |
| Dereceli zorluk 6 | 25 | 55 | Marseille %95 | 4,6 / 6 |
| İngilizce varsayılan (Şampiyonlar Ligi) | 23 | **17** | Chelsea %91 | 4,9 / 6 |
| Profil "Türkiye" | 16 | 89 | **Liverpool %82** | 3,2 / 6 |
| Profil "Süper Lig" | 10 | 15 | Fenerbahçe %100 | 4,7 / 6 |

## Kök nedenler

1. **Havuz sabit 53 kulüptü.** Bu liste 5 Kulüp modundan geliyordu. Bursaspor, Başakşehir, Sivasspor, Antalyaspor gibi kulüpler hiç yoktu. Profil Türk kulübü istediğinde verilecek kulüp bulunamıyor, boşluk İngiliz kulüpleriyle doluyordu.
2. **Zorluk ham ortak oyuncu sayısıyla ölçülüyordu.** Kolay seviye kare başına en az 20 ortak oyuncu istiyordu. Bunu yalnız birbirine çok oyuncu vermiş "merkez" kulüpler sağlıyordu, bu yüzden hep aynı kulüpler geliyordu.
3. **Profil etkisizdi.** Sıralamaya log ölçekli, çok küçük bir eğilim olarak giriyordu.

## Sonra (yeni üretici, oturum geçmişi açık)

| Durum | Farklı kulüp | 300'de farklı ızgara | En sık kulüp | Art arda 2 maçta ortak kulüp | Karede tanınmış isim (≥95) |
|---|---|---|---|---|---|
| Dereceli (Dengeli, zorluk 4) | **146** | 293 | Fenerbahçe %36 | **0,5 / 6** | ort. 7,3 · en az 4 |
| Dereceli zorluk 1 | 93 | 265 | Galatasaray %35 | 0,6 / 6 | ort. 10,4 · en az 6 |
| Dereceli zorluk 6 | 201 | 300 | Fenerbahçe %29 | 0,4 / 6 | ort. 4,6 |
| Dereceli zorluk 8 | 210 | 298 | Beşiktaş %17 | 0,1 / 6 | ort. 2,2 |
| Şampiyonlar Ligi (İngilizce varsayılan) | 31 | **297** | Chelsea %35 | 0,7 / 6 | ort. 8,2 |
| Profil "Türkiye" | 70 | 295 | Fenerbahçe %54 | 0,9 / 6 | Türk kulübü payı **%57** |
| Profil "5 Büyük Lig" | 75 | 297 | Chelsea %31 | 0,6 / 6 | Türk kulübü payı **%0** |
| Profil "Süper Lig" | 21 | 259 | Fenerbahçe %87 | 2,5 / 6 | Türk kulübü payı %100 |
| Dengeli + tuttuğun takım GS ("Sık") | 138 | 284 | **Galatasaray %87** | 1,1 / 6 | — |

## Ne değişti?

- **Havuz:** En az 25 tanınmış (tanınırlık ≥ 90) oyuncusu olan bütün kulüpler; yaklaşık 250 kulüp, rezerv takımlar hariç. Profil bu havuzu süzer ve ağırlıklandırır.
- **Zorluk:** Artık tanınmış ortak oyuncu sayısına bakılıyor. Kolay (3–4): karede en az 4 tanınmış (≥95) isim. Çok kolay: en az 6. Orta: tanınırlık ≥92 olan en az 3 isim. Zor seviyelerde ayrıca bir üst sınır var.
- **Seçim:** Ağırlıklı rastgele seçim. Ağırlık = profil çarpanı × ün ÷ √(uyumlu kulüp sayısı). Bölme, merkez kulüplerin her ızgaraya girmesini engelliyor.
- **Oturum geçmişi:** Son 3 ızgarada çıkan kulüplerin seçilme ağırlığı ×0,15'e iniyor; rövanşta aynı takımlar gelmiyor. Günlük ızgara tohumlu üretildiği için bu geçmiş orada kullanılmıyor, ızgara herkese aynı kalıyor.
- **Tuttuğun takım:** "Sık" seçiliyse ızgaraların büyük çoğunluğunda, "Normal"de yaklaşık üçte birinde çıkıyor.
- **Arkadaş odası ayarları:** Odayı kuran zorluğu, çalma kuralını (kapalı / 3 hak / katlamalı), uzatmayı ve eşleşme profilini seçiyor. Dereceli maçta ayarlar sabit: zorluk 4, Dengeli, çalma ve uzatma kapalı.

"Süper Lig" profili doğası gereği dar kalıyor: tanınmış ortak oyuncusu yeterli Türk kulübü sayısı az. Yine de 300 ızgarada 259 farklı ızgara çıkıyor (önce 15'ti).
