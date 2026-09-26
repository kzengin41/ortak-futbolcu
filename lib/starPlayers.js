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
// Son güncelleme: 26 Eylül 2026 (ölçümle 173 isim eklendi — bkz. aşağıdaki notlar)
// Önceki: 30 Ağustos 2026 (2026 Dünya Kupası sonrası — İspanya
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

  // ---------------------------------------------------------------
  // 26 Eylül 2026 — ÖLÇÜMLE EKLENDİ.
  // Kerem: "Ansiklopedi'de kesin olması gereken bazı isimler yok sanki."
  // 115 tartışmasız ünlü isim test edildi: ilk 2000'de sadece 77'si vardı
  // (%67). Eksikler arasında Pirlo, Del Piero, Raúl, Batistuta, Giggs,
  // Cannavaro, Eto'o, Kaká, Ibrahimović, Roberto Carlos, Nesta / Sergen
  // Yalçın, Tugay, Alpay, İlhan Mansız, Lefter vardı.
  // clubWeights.js'teki heuristik düzeltmeleri (kariyer prestiji + takma ad
  // hatası) bunu %84'e çıkardı ama SON KISIM HEURİSTİKLE ÇÖZÜLEMEZ: tek
  // kulüplü bir efsane (Del Piero = sadece Juventus) veriye bakarak bir
  // Juventus kadro doldurucusundan AYIRT EDİLEMEZ. O ayrımı ancak insan
  // bilgisi yapar — bu dosyanın var olma sebebi tam olarak bu.
  // Skorlar bilerek 74-88 aralığında tutuldu: 90+ bandı difficulty=1
  // (ısınma) havuzunu oluşturuyor, oraya emekli oyuncu doldurmak yeni
  // oyuncuyu 1990'ların isimleriyle karşılaştırırdı.
  "Luka Modrić": 88,
  "Zlatan Ibrahimović": 88,
  "Kaká": 86,
  "Luis Suárez": 86,
  "Alessandro Del Piero": 85,
  "Andrea Pirlo": 85,
  "Gianluigi Buffon": 85,
  "Luís Figo": 85,
  "Raúl": 85,
  "Roberto Carlos": 85,
  "Romário": 85,
  "Ryan Giggs": 85,
  "Sergio Agüero": 85,
  "Andriy Shevchenko": 84,
  "Gabriel Batistuta": 84,
  "Mesut Özil": 84,
  "Michel Platini": 84,
  "Rivaldo": 84,
  "Thomas Müller": 84,
  "Cafu": 83,
  "Fabio Cannavaro": 83,
  "Fernando Torres": 83,
  "Lautaro Martínez": 83,
  "Marco van Basten": 83,
  "Paul Scholes": 83,
  "Sadio Mané": 83,
  "Samuel Eto'o": 83,
  "Ángel Di María": 83,
  "Arjen Robben": 82,
  "Gheorghe Hagi": 82,
  "Oliver Kahn": 82,
  "Ruud Gullit": 82,
  "Ruud van Nistelrooy": 82,
  "David Villa": 81,
  "Dennis Bergkamp": 81,
  "Edinson Cavani": 81,
  "Emiliano Martínez": 81,
  "Gerard Piqué": 81,
  "Gonzalo Higuaín": 81,
  "Marcelo": 81,
  "Miroslav Klose": 81,
  "Paulo Dybala": 81,
  "Robin van Persie": 81,
  "Sergio Busquets": 81,
  "Alan Shearer": 80,
  "Alessandro Nesta": 80,
  "Alexis Sánchez": 80,
  "Bastian Schweinsteiger": 80,
  "Carles Puyol": 80,
  "Dani Alves": 80,
  "David Silva": 80,
  "Eric Cantona": 80,
  "Filippo Inzaghi": 80,
  "George Weah": 80,
  "Michael Owen": 80,
  "Patrick Vieira": 80,
  "Petr Čech": 80,
  "Philipp Lahm": 80,
  "Raheem Sterling": 80,
  "Roberto Firmino": 80,
  "Wesley Sneijder": 80,
  "Xabi Alonso": 80,
  "Carlos Tevez": 79,
  "Cesc Fàbregas": 79,
  "Clarence Seedorf": 79,
  "Deco": 79,
  "Edwin van der Sar": 79,
  "Enzo Fernández": 79,
  "Hernán Crespo": 79,
  "Hristo Stoichkov": 79,
  "James Rodríguez": 79,
  "Javier Zanetti": 79,
  "Pavel Nedvěd": 79,
  "Radamel Falcao": 79,
  "Roy Keane": 79,
  "Yaya Touré": 79,
  "Alexis Mac Allister": 78,
  "Arturo Vidal": 78,
  "Bobby Charlton": 78,
  "Christian Vieri": 78,
  "Diego Costa": 78,
  "Diego Forlán": 78,
  "Gennaro Gattuso": 78,
  "Jamie Vardy": 78,
  "Javier Mascherano": 78,
  "Jay-Jay Okocha": 78,
  "John Terry": 78,
  "Lilian Thuram": 78,
  "Peter Schmeichel": 78,
  "Rio Ferdinand": 78,
  "Riyad Mahrez": 78,
  "Robert Pires": 78,
  "Marcel Desailly": 77,
  "Nemanja Vidić": 77,
  "Nicolas Anelka": 77,
  "Rui Costa": 77,
  "Ashley Cole": 76,
  "Davor Šuker": 76,
  "Fabien Barthez": 76,
  "Marco Materazzi": 76,
  "Michael Essien": 76,
  "Rafael van der Vaart": 76,
  "Roger Milla": 76,
  "Zvonimir Boban": 76,
  "Frédéric Kanouté": 75,
  "Gary Neville": 75,
  "Jordan Henderson": 75,
  "Nwankwo Kanu": 75,
  "Ronald Koeman": 75,
  "Sami Khedira": 75,
  "Christian Karembeu": 74,
  "Claudio Bravo": 74,
  "Denis Law": 74,
  "El Hadji Diouf": 74,
  "Emmanuel Petit": 74,
  "Francesco Toldo": 74,
  "Frank Rijkaard": 74,
  "Gary Medel": 74,
  "Gianluca Zambrotta": 74,
  "Harry Maguire": 74,
  "Juan Cuadrado": 74,
  "Kolo Touré": 74,
  "Nuno Gomes": 74,
  "Pauleta": 74,
  "Rigobert Song": 74,
  "Sylvain Wiltord": 74,
  "Youri Djorkaeff": 74,
  "Éver Banega": 74,
  "Claudio Ranieri": 72,
  "Mahamadou Diarra": 72,
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

  // ---------------------------------------------------------------
  // 26 Eylül 2026 — Türk futbol tarihi. Aynı ölçümde 39 ünlü Türk
  // oyuncudan 14'ü ilk 2000'in dışındaydı. Türk kullanıcı için bu isimler
  // dünya yıldızlarından daha tanıdık, o yüzden ayrı ve cömert puanlandı.
  "Sergen Yalçın": 82,
  "Barış Alper Yılmaz": 80,
  "Orkun Kökçü": 80,
  "Tugay Kerimoğlu": 80,
  "İlhan Mansız": 80,
  "Merih Demiral": 79,
  "Okan Buruk": 79,
  "Alpay Özalan": 78,
  "Altay Bayındır": 78,
  "Fatih Terim": 78,
  "Hamit Altıntop": 78,
  "Lefter Küçükandonyadis": 78,
  "Volkan Demirel": 78,
  "Yunus Akgün": 78,
  "Yusuf Yazıcı": 78,
  "Zeki Çelik": 78,
  "Çağlar Söyüncü": 78,
  "İrfan Can Kahveci": 78,
  "Caner Erkin": 77,
  "Cengiz Ünder": 77,
  "Gökhan Gönül": 77,
  "Hasan Şaş": 77,
  "Mert Günok": 77,
  "Oğuz Çetin": 77,
  "Selçuk İnan": 77,
  "Semih Kılıçsoy": 77,
  "Abdülkerim Bardakcı": 76,
  "Enes Ünal": 76,
  "Mehmet Topal": 76,
  "Ogün Temizkanoğlu": 76,
  "Ümit Davala": 76,
  "Gökdeniz Karadeniz": 75,
  "Halil Altıntop": 75,
  "Kaan Ayhan": 75,
  "Salih Özcan": 75,
  "Semih Şentürk": 75,
  "Cemil Turan": 74,
  "Colin Kâzım-Richards": 74,
  "Doğukan Sinik": 74,
  "Gökhan Zan": 74,
  "Hakan Ünsal": 74,
  "Mehmet Aurélio": 74,
  "Servet Çetin": 74,
  "Tayfur Havutçu": 74,
  "Arda Kızıldağ": 72,
  "Emirhan Topçu": 72,
};
