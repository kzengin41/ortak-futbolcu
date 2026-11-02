# Paket 43 — simülasyon ham tabloları

Üretici: test düzeneği `t42/sim43.mjs` (her satır 300 tur, oturum = 10 tur). Aynı betik önce Paket 42 koduyla (ÖNCE), sonra Paket 43 koduyla (SONRA) çalıştırıldı. Rastgele olduğu için düzeltilmeyen satırlarda ±%3 oynama normaldir.

## ÖNCE (Paket 42)

### 1. Ortak Kulüp — Kulüp × Kulüp (CPU, zorluk 5)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Dengeli | 211/300 | 86 | Fenerbahçe %20, Galatasaray %15, Paris Saint-Germain %12 | %37 | %41 | %15 | %4 |
| Türkiye | 137/300 | 48 | Fenerbahçe %32, Galatasaray %28, Beşiktaş %19 | %75 | %75 | %28 | %14 |
| Süper Lig | 112/300 | 30 | Galatasaray %28, Fenerbahçe %28, Beşiktaş %27 | %100 | %80 | %28 | %14 |
| 5 Büyük Lig | 177/300 | 70 | Paris Saint-Germain %17, Bayern Munich %15, Barcelona %13 | %0 | %0 | %0 | %9 |
| Şampiyonlar Ligi | 130/300 | 32 | Paris Saint-Germain %17, Bayern Munich %16, Real Madrid %11 | %12 | %23 | %9 | %8 |
| Nostalji | 173/300 | 78 | Fenerbahçe %19, Galatasaray %19, Beşiktaş %17 | %52 | %52 | %19 | %6 |
| Dünya | 229/300 | 91 | Bayern Munich %12, Paris Saint-Germain %11, Real Madrid %8 | %12 | %14 | %5 | %4 |
| Dengeli + GS (Sık) | 178/300 | 78 | Galatasaray %40, Fenerbahçe %15, Beşiktaş %10 | %46 | %59 | %40 | %10 |

### 2. Ortak Kulüp — Kulüp × Ülke (CPU, zorluk 5)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---| ülke |
| Dengeli | 205/300 | 74 | Fenerbahçe %8, Beşiktaş %8, Real Madrid %6 | %28 | %23 | %5 | %3 | ülkeler: 36, en sık: Brazil %13, Portugal %10, Netherlands %8
| Türkiye | 126/300 | 35 | Galatasaray %13, Fenerbahçe %13, Manchester City %11 | %45 | %37 | %13 | %6 | ülkeler: 36, en sık: Spain %12, Brazil %11, Portugal %10
| Süper Lig | 40/300 | 13 | Fenerbahçe %32, Galatasaray %29, Beşiktaş %13 | %100 | %82 | %29 | %20 | ülkeler: 20, en sık: Portugal %13, Brazil %11, Netherlands %10
| 5 Büyük Lig | 189/300 | 51 | Real Madrid %10, Barcelona %7, Inter Milan %7 | %0 | %0 | %0 | %3 | ülkeler: 39, en sık: Spain %9, Netherlands %9, Portugal %9
| Şampiyonlar Ligi | 140/300 | 30 | Real Madrid %14, Manchester City %8, Manchester United %7 | %6 | %6 | %2 | %5 | ülkeler: 37, en sık: Argentina %9, Brazil %8, Spain %7
| Nostalji | 203/300 | 72 | Fenerbahçe %11, Galatasaray %7, Liverpool %5 | %30 | %25 | %7 | %3 | ülkeler: 40, en sık: Netherlands %10, Brazil %9, France %7
| Dünya | 202/300 | 63 | Real Madrid %7, Manchester United %6, Liverpool %6 | %7 | %4 | %1 | %4 | ülkeler: 38, en sık: Spain %9, France %8, Netherlands %8
| Dengeli + GS (Sık) | 184/300 | 69 | Galatasaray %22, Fenerbahçe %6, Real Madrid %5 | %39 | %33 | %22 | %3 | ülkeler: 39, en sık: Brazil %12, Spain %10, Netherlands %10

### 3. 5 Kulüp (CPU, varsayılan zorluk = Zor havuzu)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Dengeli | 300/300 | 48 | Trabzonspor %20, Roma %14, Valencia %14 | %10 | %45 | %11 | %0 |
| Türkiye | 270/300 | 16 | Trabzonspor %63, Chelsea %39, Everton %39 | %22 | %83 | %16 | %34 |
| Süper Lig | 300/300 | 53 | Beşiktaş %35, Galatasaray %33, Fenerbahçe %32 | %24 | %100 | %33 | %5 |
| 5 Büyük Lig | 299/300 | 35 | Inter Milan %17, Borussia Dortmund %16, Tottenham Hotspur %16 | %0 | %0 | %0 | %0 |
| Şampiyonlar Ligi | 300/300 | 32 | Benfica %20, Porto %20, RB Leipzig %19 | %7 | %33 | %11 | %0 |
| Nostalji | 300/300 | 48 | Trabzonspor %18, Celtic %15, Shakhtar Donetsk %15 | %9 | %44 | %9 | %0 |
| Dünya | 300/300 | 53 | Fiorentina %12, Leicester City %12, Borussia Dortmund %12 | %8 | %35 | %11 | %0 |
| Dengeli + GS (Sık) | 300/300 | 48 | Trabzonspor %19, Lazio %13, Manchester United %13 | %10 | %46 | %11 | %0 |

### 4. Futbolcu XOX (CPU, zorluk 4)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Dengeli | 297/300 | 209 | Trabzonspor %13, Fenerbahçe %13, Galatasaray %12 | %26 | %39 | %12 | %2 |
| Türkiye | 296/300 | 80 | Rangers %24, Celtic %23, Eyüpspor %22 | %52 | %45 | %13 | %6 |
| Süper Lig | 258/300 | 23 | Alanyaspor %55, Eyüpspor %53, Fatih Karagümrük %45 | %100 | %62 | %19 | %22 |
| 5 Büyük Lig | 297/300 | 93 | Sevilla %26, Marseille %21, Liverpool %16 | %0 | %0 | %0 | %4 |
| Şampiyonlar Ligi | 299/300 | 32 | Galatasaray %26, Manchester United %25, Benfica %23 | %11 | %59 | %26 | %6 |
| Nostalji | 300/300 | 205 | Fenerbahçe %16, Beşiktaş %15, Galatasaray %14 | %27 | %46 | %14 | %3 |
| Dünya | 300/300 | 228 | Fenerbahçe %15, Chelsea %13, Liverpool %11 | %13 | %33 | %10 | %2 |
| Dengeli + GS (Sık) | 299/300 | 207 | Galatasaray %79, Liverpool %11, Alanyaspor %10 | %30 | %87 | %79 | %11 |

### 5. Kim Bu Futbolcu? (CPU) — seviye 3 (başlangıç) ve seviye 6

| Durum | farklı futbolcu | Türk kulübünde oynamış | 2+ Türk kulübü | son maçı 2010 öncesi | en sık |
|---|---|---|---|---|---|
| Dengeli · sv3 | 129/300 | %26 | %8 | %13 | Andrea Pirlo ×5, Mason Greenwood ×5, Luis Suárez ×5 |
| Türkiye · sv3 | 132/300 | %36 | %14 | %8 | Cesc Fàbregas ×6, Luis Suárez ×6, Jude Bellingham ×6 |
| Süper Lig · sv3 | 128/300 | %100 | %37 | %11 | Alex ×7, Semih Şentürk ×6, Yunus Akgün ×6 |
| 5 Büyük Lig · sv3 | 130/300 | %26 | %8 | %16 | Erling Haaland ×6, Luis Suárez ×6, Jordan Henderson ×5 |
| Şampiyonlar Ligi · sv3 | 125/300 | %20 | %5 | %14 | Luis Suárez ×8, Jude Bellingham ×7, Rivaldo ×6 |
| Nostalji · sv3 | 131/300 | %28 | %11 | %21 | Luis Suárez ×7, Miroslav Klose ×6, Paulo Dybala ×5 |
| Dünya · sv3 | 124/300 | %23 | %8 | %14 | Luis Suárez ×8, Thibaut Courtois ×6, James Rodríguez ×6 |
| Dengeli + GS (Sık) · sv3 | 132/300 | %23 | %9 | %16 | Luis Suárez ×10, Erling Haaland ×6, Zinedine Zidane ×5 |
| Dengeli · sv6 | 226/300 | %24 | %13 | %18 | Jordan Ayew ×3, Hasan Şaş ×3, Thibaut Courtois ×3 |
| Türkiye · sv6 | 240/300 | %31 | %14 | %15 | André Schürrle ×4, Ole Gunnar Solskjær ×4, Raphinha ×3 |
| Süper Lig · sv6 | 227/300 | %100 | %48 | %14 | Eric Bailly ×5, Miroslav Stoch ×3, Ozan Tufan ×3 |

### 6. Online Ortak Kulüp (sunucu çift havuzu, 1120 çift)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---| uygun çift |
| Dereceli (standart profil) | 255/300 | 104 | Paris Saint-Germain %7, Galatasaray %6, Chelsea %5 | %25 | %17 | %6 | %3 |
| Arkadaş odası · Dengeli | 271/300 | 108 | Beşiktaş %8, Galatasaray %8, Fenerbahçe %7 | %37 | %25 | %8 | %3 | 961 |
| Arkadaş odası · Türkiye | 210/300 | 54 | Beşiktaş %11, Fenerbahçe %9, Galatasaray %9 | %69 | %36 | %9 | %4 | 361 |
| Arkadaş odası · Süper Lig | 176/300 | 31 | Galatasaray %13, Eyüpspor %12, Fenerbahçe %11 | %100 | %38 | %13 | %7 | 228 |
| Arkadaş odası · 5 Büyük Lig | 234/300 | 83 | Bayern Munich %7, Liverpool %7, Roma %7 | %0 | %0 | %0 | %3 | 498 |
| Arkadaş odası · Şampiyonlar Ligi | 185/300 | 32 | Fenerbahçe %11, Roma %10, Ajax %10 | %12 | %22 | %8 | %5 | 293 |
| Arkadaş odası · Nostalji | 260/300 | 113 | Paris Saint-Germain %9, Galatasaray %7, Fenerbahçe %7 | %33 | %23 | %7 | %2 | 961 |
| Arkadaş odası · Dünya | 262/300 | 110 | Galatasaray %8, Paris Saint-Germain %8, Fenerbahçe %7 | %32 | %24 | %8 | %3 | 961 |
| Arkadaş odası · Dengeli + GS (Sık) | 263/300 | 106 | Beşiktaş %7, Inter Milan %7, Galatasaray %7 | %32 | %19 | %7 | %3 | 961 |

### 7. Online Kim Bu (profil kullanılmıyor)

| Durum | farklı futbolcu | Türk kulübünde oynamış | 2+ Türk kulübü | son maçı 2010 öncesi | en sık |
|---|---|---|---|---|---|
| Online Kim Bu | 225/300 | %25 | %7 | %11 | Lucas Torreira ×4, Raúl ×3, N'Golo Kanté ×3 |

### 8. Online 5 Kulüp / Online Kulüp × Ülke (dereceli = standart profil)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Online 5 Kulüp · dereceli | 300/300 | 37 | Trabzonspor %24, Napoli %18, Atlético Madrid %18 | %11 | %47 | %8 | %0 |
| Online Kulüp × Ülke · dereceli | 141/300 | 47 | Fenerbahçe %11, Real Madrid %9, Galatasaray %8 | %27 | %23 | %8 | %3 |

### 9. Günlük oyunlar (365 gün, herkes aynı)

- Günün Kadrosu: 365 günde 133 farklı kadro. Toplam kadro: 465.
- Günün Izgarası (GS geçen gün: 78): 221/365 farklı ızgara, 55 farklı kulüp; en sık: Manchester City 123, Liverpool 113, Manchester United 111, Barcelona 106, Chelsea 103.
- Günün 5 Kulübü: 53 farklı kulüp; en sık: Barcelona 85, Paris Saint-Germain 70, Real Madrid 67, Manchester City 65, Juventus 61.

## SONRA (Paket 43)

### 1. Ortak Kulüp — Kulüp × Kulüp (CPU, zorluk 5)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Dengeli | 223/300 | 94 | Galatasaray %16, Fenerbahçe %13, Beşiktaş %12 | %33 | %40 | %16 | %3 |
| Türkiye | 160/300 | 47 | Fenerbahçe %25, Galatasaray %22, Beşiktaş %18 | %71 | %67 | %22 | %8 |
| Süper Lig | 127/300 | 28 | Galatasaray %24, Beşiktaş %23, Fenerbahçe %23 | %100 | %71 | %24 | %11 |
| 5 Büyük Lig | 199/300 | 65 | Paris Saint-Germain %13, Bayern Munich %13, Real Madrid %12 | %0 | %0 | %0 | %6 |
| Şampiyonlar Ligi | 153/300 | 32 | Paris Saint-Germain %16, Bayern Munich %13, Fenerbahçe %12 | %13 | %24 | %8 | %7 |
| Nostalji | 190/300 | 88 | Galatasaray %20, Fenerbahçe %16, Beşiktaş %12 | %47 | %46 | %20 | %5 |
| Dünya | 235/300 | 91 | Paris Saint-Germain %10, Bayern Munich %9, Real Madrid %8 | %12 | %16 | %7 | %4 |
| Dengeli + GS (Sık) | 209/300 | 91 | Galatasaray %35, Fenerbahçe %13, Beşiktaş %10 | %39 | %54 | %35 | %8 |

### 2. Ortak Kulüp — Kulüp × Ülke (CPU, zorluk 5)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---| ülke |
| Dengeli | 220/300 | 67 | Galatasaray %6, Manchester United %5, Fenerbahçe %5 | %22 | %18 | %6 | %3 | ülkeler: 42, en sık: Brazil %10, Germany %7, Netherlands %7
| Türkiye | 142/300 | 36 | Fenerbahçe %14, Galatasaray %11, Liverpool %11 | %44 | %35 | %11 | %6 | ülkeler: 39, en sık: Spain %10, Brazil %10, Portugal %8
| Süper Lig | 42/300 | 13 | Fenerbahçe %27, Galatasaray %26, Beşiktaş %11 | %100 | %70 | %26 | %16 | ülkeler: 21, en sık: Portugal %13, Brazil %10, Netherlands %8
| 5 Büyük Lig | 208/300 | 57 | Real Madrid %7, Liverpool %7, Manchester United %6 | %0 | %0 | %0 | %3 | ülkeler: 41, en sık: Spain %10, Turkey %10, Brazil %8
| Şampiyonlar Ligi | 156/300 | 30 | Real Madrid %8, Manchester United %7, Manchester City %7 | %12 | %12 | %7 | %3 | ülkeler: 36, en sık: Spain %9, Portugal %8, Argentina %7
| Nostalji | 204/300 | 69 | Galatasaray %8, Fenerbahçe %7, Beşiktaş %6 | %28 | %22 | %8 | %3 | ülkeler: 43, en sık: Brazil %13, Turkey %8, France %8
| Dünya | 221/300 | 62 | Manchester United %7, Chelsea %6, Liverpool %5 | %10 | %10 | %3 | %1 | ülkeler: 44, en sık: Spain %10, Brazil %8, Netherlands %7
| Dengeli + GS (Sık) | 215/300 | 63 | Galatasaray %15, Fenerbahçe %8, Barcelona %4 | %32 | %27 | %15 | %4 | ülkeler: 42, en sık: Brazil %10, Netherlands %9, Belgium %8

### 3. 5 Kulüp (CPU, varsayılan zorluk = Zor havuzu)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Dengeli | 300/300 | 48 | Trabzonspor %21, Sevilla %14, Galatasaray %13 | %11 | %49 | %13 | %0 |
| Türkiye | 299/300 | 38 | Adana Demirspor %19, İstanbulspor %18, Samsunspor %18 | %71 | %56 | %15 | %0 |
| Süper Lig | 295/300 | 22 | Galatasaray %35, Beşiktaş %34, Fenerbahçe %31 | %100 | %100 | %35 | %5 |
| 5 Büyük Lig | 300/300 | 34 | Barcelona %17, Atlético Madrid %17, AC Milan %17 | %0 | %0 | %0 | %0 |
| Şampiyonlar Ligi | 300/300 | 32 | Inter Milan %20, Villarreal %20, Porto %19 | %6 | %31 | %11 | %0 |
| Nostalji | 300/300 | 48 | Trabzonspor %20, Borussia Dortmund %13, Roma %12 | %10 | %43 | %10 | %0 |
| Dünya | 300/300 | 53 | Roma %13, Barcelona %12, Galatasaray %12 | %8 | %39 | %12 | %0 |
| Dengeli + GS (Sık) | 300/300 | 48 | Trabzonspor %20, Inter Milan %13, West Ham United %12 | %10 | %43 | %11 | %0 |

### 4. Futbolcu XOX (CPU, zorluk 4)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Dengeli | 297/300 | 192 | Fenerbahçe %17, Trabzonspor %15, Beşiktaş %14 | %36 | %46 | %14 | %3 |
| Türkiye | 285/300 | 76 | Alanyaspor %26, Fatih Karagümrük %25, Galatasaray %25 | %64 | %59 | %25 | %9 |
| Süper Lig | 263/300 | 23 | Alanyaspor %57, Eyüpspor %55, Fatih Karagümrük %45 | %100 | %56 | %18 | %22 |
| 5 Büyük Lig | 295/300 | 92 | Sevilla %23, Valencia %21, Marseille %20 | %0 | %0 | %0 | %5 |
| Şampiyonlar Ligi | 299/300 | 32 | Galatasaray %30, Manchester United %26, Benfica %25 | %12 | %62 | %30 | %7 |
| Nostalji | 298/300 | 200 | Fenerbahçe %19, Beşiktaş %18, Galatasaray %15 | %34 | %48 | %15 | %3 |
| Dünya | 300/300 | 227 | Beşiktaş %13, Liverpool %13, Galatasaray %12 | %13 | %36 | %12 | %2 |
| Dengeli + GS (Sık) | 296/300 | 191 | Galatasaray %81, Fatih Karagümrük %14, Alanyaspor %13 | %36 | %89 | %81 | %13 |

### 5. Kim Bu Futbolcu? (CPU) — seviye 3 (başlangıç) ve seviye 6

| Durum | farklı futbolcu | Türk kulübünde oynamış | 2+ Türk kulübü | son maçı 2010 öncesi | en sık |
|---|---|---|---|---|---|
| Dengeli · sv3 | 137/300 | %37 | %14 | %15 | Leroy Sané ×6, Luis Suárez ×5, Volkan Demirel ×5 |
| Türkiye · sv3 | 142/300 | %47 | %16 | %9 | İlkay Gündoğan ×5, Lucas Torreira ×5, Alex ×5 |
| Süper Lig · sv3 | 139/300 | %100 | %42 | %15 | Álvaro Morata ×5, Ederson ×5, Berke Özer ×5 |
| 5 Büyük Lig · sv3 | 138/300 | %27 | %7 | %18 | Victor Osimhen ×6, Didier Drogba ×5, Luis Suárez ×5 |
| Şampiyonlar Ligi · sv3 | 145/300 | %26 | %8 | %15 | Luis Suárez ×6, Nihat Kahveci ×4, Pierre-Emerick Aubameyang ×4 |
| Nostalji · sv3 | 138/300 | %28 | %15 | %58 | Okan Buruk ×5, Paolo Rossi ×5, Guti ×5 |
| Dünya · sv3 | 137/300 | %28 | %10 | %15 | Arda Turan ×5, Edin Džeko ×5, Erling Haaland ×4 |
| Dengeli + GS (Sık) · sv3 | 138/300 | %36 | %10 | %14 | İlkay Gündoğan ×6, Alex ×6, N'Golo Kanté ×5 |
| Dengeli · sv6 | 237/300 | %41 | %16 | %15 | Bertuğ Yıldırım ×4, Kevin-Prince Boateng ×3, Willian ×3 |
| Türkiye · sv6 | 238/300 | %51 | %20 | %14 | Felipe Melo ×3, Alpay Özalan ×3, Eljif Elmas ×3 |
| Süper Lig · sv6 | 247/300 | %100 | %47 | %17 | Nordin Amrabat ×3, Zeki Çelik ×3, Dries Mertens ×3 |

### 6. Online Ortak Kulüp (sunucu çift havuzu, 1120 çift)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---| uygun çift |
| Dereceli (standart profil) | 260/300 | 113 | Fenerbahçe %7, Galatasaray %7, Bayern Munich %5 | %36 | %23 | %7 | %2 |
| Arkadaş odası · Dengeli | 258/300 | 105 | Fenerbahçe %8, Beşiktaş %7, Galatasaray %6 | %32 | %24 | %6 | %4 | 961 |
| Arkadaş odası · Türkiye | 201/300 | 53 | Fenerbahçe %13, Beşiktaş %12, Trabzonspor %12 | %75 | %45 | %10 | %3 | 355 |
| Arkadaş odası · Süper Lig | 169/300 | 31 | Beşiktaş %12, Gençlerbirliği %11, Fenerbahçe %11 | %100 | %39 | %8 | %8 | 228 |
| Arkadaş odası · 5 Büyük Lig | 229/300 | 82 | Paris Saint-Germain %10, Bayern Munich %9, Manchester United %8 | %0 | %0 | %0 | %4 | 492 |
| Arkadaş odası · Şampiyonlar Ligi | 189/300 | 32 | Juventus %11, Galatasaray %10, Inter Milan %10 | %12 | %23 | %10 | %6 | 293 |
| Arkadaş odası · Nostalji | 264/300 | 108 | Roma %7, Beşiktaş %7, Galatasaray %6 | %32 | %22 | %6 | %5 | 961 |
| Arkadaş odası · Dünya | 254/300 | 114 | Galatasaray %7, Chelsea %7, Paris Saint-Germain %6 | %31 | %20 | %7 | %2 | 961 |
| Arkadaş odası · Dengeli + GS (Sık) | 260/300 | 115 | Galatasaray %8, Fenerbahçe %6, Liverpool %6 | %30 | %22 | %8 | %3 | 961 |

### 7. Online Kim Bu (profil kullanılmıyor)

| Durum | farklı futbolcu | Türk kulübünde oynamış | 2+ Türk kulübü | son maçı 2010 öncesi | en sık |
|---|---|---|---|---|---|
| Online Kim Bu | 215/300 | %27 | %8 | %12 | Robin van Persie ×5, Gianluigi Buffon ×4, N'Golo Kanté ×4 |

### 8. Online 5 Kulüp / Online Kulüp × Ülke (dereceli = standart profil)

| Durum | farklı tur | farklı kulüp | en sık 3 kulüp (turların %'si) | Türk kulübü payı | 4 büyükten biri | GS geçen | art arda turda aynı kulüp |
|---|---|---|---|---|---|---|---|
| Online 5 Kulüp · dereceli | 300/300 | 37 | Trabzonspor %22, Arsenal %17, Borussia Dortmund %17 | %11 | %47 | %12 | %0 |
| Online Kulüp × Ülke · dereceli | 165/300 | 52 | Galatasaray %8, Real Madrid %8, Fenerbahçe %7 | %23 | %19 | %8 | %3 |

### 9. Günlük oyunlar (365 gün, herkes aynı)

- Günün Kadrosu: 365 günde 133 farklı kadro. Toplam kadro: 465.
- Günün Izgarası (GS geçen gün: 105): 361/365 farklı ızgara, 180 farklı kulüp; en sık: Galatasaray 105, Fenerbahçe 102, Beşiktaş 80, Chelsea 63, AC Milan 58.
- Günün 5 Kulübü: 53 farklı kulüp; en sık: Barcelona 85, Paris Saint-Germain 70, Real Madrid 67, Manchester City 65, Juventus 61.
