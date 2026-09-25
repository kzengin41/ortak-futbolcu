// "ŞU AN ünlü" oyuncular — elle küratörlenmiş, kolayca güncellenebilir liste.
//
// NEDEN BU DOSYA VAR: Kulüp/kariyer verisinden otomatik hesaplanan popülerlik
// (bkz. clubWeights.js), bir oyuncunun HANGİ kulüpte oynadığını bilir ama o
// kulüpte YILDIZ mı yoksa kadro doldurucu mu olduğunu bilemez — "Beşiktaş'ta
// 3 maça çıkmış bir oyuncu" ile "Beşiktaş'ın yıldızı" arasında ayrım yapamaz.
// Bu yüzden gerçek dünya ünü, Wikipedia görüntülenme sayısı gibi otomatik/
// kırılgan bir veri yerine BURADA elle tutuluyor.
//
// GÜNCELLEME REHBERİ (sezonda bir kez gözden geçir yeter):
//   - Skor 90-100: "Herkes tanır" seviyesi — Messi/Ronaldo/güncel Ballon d'Or
//     adayları gibi. Bu skor difficulty=1 (en kolay/ısınma) havuzunun
//     TAMAMINI oluşturur, o yüzden buraya sadece GERÇEKTEN çok ünlü isimler
//     ekle.
//   - Skor 80-89: Çok tanınan güncel yıldızlar / son yılların en formda
//     oyuncuları — herkes tanımaz ama futbol takip eden çoğu kişi tanır.
//   - Skor 75-79: Yükselen yıldızlar / son sezon çok konuşulan isimler.
//   - Bir oyuncu artık eskisi kadar konuşulmuyorsa skorunu düşür ya da
//     satırı tamamen sil (heuristik puana geri düşer, sıfırlanmaz).
//   - İsimler players.json'daki `name` alanıyla BİREBİR aynı olmalı (aksan
//     dahil) — eşleşmezse hiçbir etkisi olmaz. Emin değilsen ekledikten
//     sonra oyunda "kim bu" testinde ara.
//
// Son güncelleme: 30 Ağustos 2026 (2026 Dünya Kupası sonrası — İspanya
// şampiyon, Messi/Ronaldo son turnuvaları, 2025 Ballon d'Or: Dembélé).
export const GLOBAL_STARS = {
  // --- Şu anın en büyük yıldızları (90-100) ---
  "Lionel Messi": 100,
  "Cristiano Ronaldo": 100,
  "Kylian Mbappé": 97,
  "Erling Haaland": 96,
  "Lamine Yamal": 96,
  "Ousmane Dembélé": 94, // 2025 Ballon d'Or sahibi
  "Jude Bellingham": 92,
  "Vinícius Júnior": 91,
  "Neymar": 90,

  // --- Çok tanınan güncel yıldızlar (80-89) ---
  "Kevin De Bruyne": 87,
  "Mohamed Salah": 87,
  "Harry Kane": 86,
  "Robert Lewandowski": 86,
  "Antoine Griezmann": 84,
  "Pedri": 83,
  "Karim Benzema": 82,
  "Virgil van Dijk": 81,
  "Julián Alvarez": 81,
  "Rodri": 80,

  // --- Yükselen / son sezon çok konuşulan isimler (75-79) ---
  "Bukayo Saka": 79,
  "Bradley Barcola": 78,
  "Florian Wirtz": 78,
  "Achraf Hakimi": 76,
  "Phil Foden": 76,
  "Declan Rice": 75,

  // --- Efsaneler — emekli ama HERKESİN tanıdığı isimler; güncellik onları
  // cezalandırmasın diye burada tutuluyorlar, heuristik skorları çoktan
  // düşmüş olabilir ama küratörlü taban onları yine üstte tutuyor.
  "Zinedine Zidane": 90,
  "Ronaldinho": 89,
  "Ronaldo": 88, // "Fenomen" — R9, Ronaldo Nazário
  "Diego Maradona": 92,
  "Pelé": 92,
  "Thierry Henry": 84,
  "David Beckham": 83,
  "Andrés Iniesta": 83,
  "Xavi": 80,
  "Franz Beckenbauer": 80,
  "Johan Cruyff": 82,
  "Paolo Maldini": 79,
  "Didier Drogba": 79,
  "Wayne Rooney": 79,
  "Steven Gerrard": 79,
  "Frank Lampard": 77,
  "Iker Casillas": 78,
  "Roberto Baggio": 77,
  "George Best": 76,
  "Zico": 76,
  "Alisson Becker": 76,
  "Manuel Neuer": 77,
  "Sergio Ramos": 78,
  "Thibaut Courtois": 76,
  "Toni Kroos": 78,
};

// Türkiye milli takımı / Türk futbolunun güncel en tanınan isimleri —
// Türkiye-4-büyükler kulüp bonusundan AYRI ve ONA EK bir katman: bu liste
// "gerçekten ünlü Türk oyuncusu" ile "büyük kulüpte kısa süre forma giymiş
// sıradan oyuncu" arasındaki farkı da elle tutuyor.
export const TR_STARS = {
  "Hakan Çalhanoğlu": 88,
  "Arda Güler": 87,
  "Kenan Yıldız": 84,
  "İlkay Gündoğan": 83,
  "Hakan Şükür": 85, // Türk futbolunun en efsanevi ismi, güncellik onu cezalandırmasın
  "Arda Turan": 83,
  "Rüştü Reçber": 80,
  "Emre Belözoğlu": 79,
  "Alex": 79, // Alex de Souza — Fenerbahçe efsanesi
  "Tuncay Şanlı": 77,
  "Nihat Kahveci": 77,
  "Burak Yılmaz": 78,
  "Uğurcan Çakır": 77,
  "Kerem Aktürkoğlu": 76,
  "Ferdi Kadıoğlu": 76,
  "Cenk Tosun": 75,
};
