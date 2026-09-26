// 4 Eylül 2026 (Kerem: "burada Caner Erkin'i nasıl bilemedi?" — 5 Kulüp
// turunda "Internazionale" varken Caner Erkin sadece 1 kulüp eşleşmesi alıp
// 0 puan aldı) — KÖK NEDEN: players.json, AYNI GERÇEK KULÜBÜ birden fazla
// FARKLI metinle kaydetmiş (kaynak Wikipedia dökümü olduğu için). Örnekler:
//   "Inter Milan" (602 kayıt) ve "Internazionale" (316) ve "Inter" (55)
//   "Barcelona" (577) ve "FC Barcelona" (802)
//   "Real Madrid" (567) ve "Real Madrid Club de Fútbol" (319)
//   "AC Milan" (907) ve "Milan" (327)
// Bu varyantlar veri setinde ASLA aynı oyuncuda birlikte geçmiyor (kontrol
// edildi: 0 çakışma) — yani gerçekten aynı kulübün iki ayrı yazımı, oyuncular
// bunlar arasında BÖLÜNMÜŞ durumda. Sonuç: bir turda "Internazionale" çıkınca
// "Inter Milan" kaydı olan Caner Erkin gibi oyuncular HİÇ eşleşmiyordu.
//
// Aşağıdaki gruplar ELLE seçildi ve her biri veri setine karşı doğrulandı.
// KURAL: sadece BİRİNCİ TAKIM (A takımı) yazımları — "Barcelona B",
// "Juventus U23", "Bilbao Athletic" (Bilbao'nun B takımı), "Real Madrid
// Castilla" gibi altyapı/rezerv takımlar BİLİNÇLİ OLARAK HARİÇ, çünkü onlar
// gerçekten ayrı takımlar ve oyunda "o kulüpte oynadı" saymamalı.
//
// 26 Eylül 2026 (Kerem: "başakşehir ve istanbul başakşehir diye iki ayrı takım
// var... hepsi tek bir kayıtta olmalı") — ARTIK VERİ SEVİYESİNDE BİRLEŞİK:
// players.json ve clubs.js içindeki bütün varyantlar aşağıdaki KANONİK ada
// çevrildi (scripts yok; birleştirme listesi kulup_birlestirme_raporu.csv).
// Bu tablo yine de duruyor çünkü: (1) logo, lig ön ayarı ve kulüp ağırlığı
// listelerinde eski yazımlar geçiyor, (2) oyuncu "İstanbul Başakşehir" ya da
// "Rizespor" diye YAZARSA doğru kulübe eşlensin, (3) ileride kadro
// güncelleme scripti eski yazımı tekrar eklerse oyun yine bölünmesin.
// Türk kulüplerinde sponsor adı (Kardemir Karabükspor), eski ad (İstanbul BB
// -> Başakşehir, Gaziantep BB -> Gaziantep FK) ve yazım farkları birleşti.
// Kerem'in kararıyla (26 Eylül) şehrin kulübü olarak TEK kayıt: Gaziantepspor ->
// Gaziantep FK, BB Erzurumspor -> Erzurumspor, Malatyaspor -> Yeni Malatyaspor,
// Osmanlıspor -> Ankaraspor. Ayrı kalanlar: 1461 Trabzon, rezerv/altyapı takımları.
export const CLUB_ALIAS_GROUPS = {
  "Başakşehir": ["İstanbul Başakşehir", "İstanbul Başakşehir F.K.", "Istanbul Basaksehir", "Medipol Başakşehir", "İstanbul Büyükşehir Belediyespor", "İstanbul Büyükşehir Belediyesi", "İstanbul BB", "Istanbul BB", "İstanbul B.B.", "Istanbul B.B.", "İstanbul BŞB"],
  "Beşiktaş": ["Beşiktaş (Football)", "Besiktas", "Beşiktaş JK", "Beşiktaş J.K"],
  "Beşiktaş A2": ["Beşiktaş JK A2"],
  "Galatasaray": ["Galatasaray SK"],
  "Fenerbahçe": ["Fenerbahçe SK", "Fenerbahce", "Fenerbahçe Istanbul"],
  "Fenerbahçe A2": ["Fenerbahçe S.K. A2"],
  "Çaykur Rizespor": ["Rizespor", "Caykur Rizespor"],
  "Ankaragücü": ["MKE Ankaragücü", "Ankaragucu"],
  "Gençlerbirliği": ["Gençlerbirligi", "Genclerbirligi", "Gençlerbirliği SK"],
  "Gençlerbirliği OFTAŞ": ["Gençlerbirliği Oftaşspor"],
  "Darıca Gençlerbirliği": ["Darica Genclerbirligi"],
  "Göztepe": ["Göztepe SK", "Göztepe Izmir", "Göztepe İzmir", "Göztepespor"],
  "Kasımpaşa": ["Kasimpasa", "Kasımpaşa SK", "Kasımpaşaspor"],
  "Fatih Karagümrük": ["Fatih Karagumruk", "Karagümrük", "Karagümrükspor", "Centone Karagümrük", "Fath Karagümrük"],
  "Altay": ["Altay SK", "Altay Izmir"],
  "Eyüpspor": ["Eyupspor"],
  "Eskişehirspor": ["Eskisehirspor"],
  "Elazığspor": ["Elazigspor", "Elâzığspor"],
  "Bandırmaspor": ["Bandirmaspor"],
  "Ümraniyespor": ["Umraniyespor"],
  "Ankaraspor": ["Osmanlıspor", "Osmanlispor"],
  "Erzurumspor": ["BB Erzurumspor", "Erzurum BB", "Erzurumspor F.K.", "Büyükşehir Belediye Erzurumspor", "Erzurumspor FK"],
  "Yeni Malatyaspor": ["Malatyaspor"],
  "İstanbulspor": ["Istanbulspor", "Ístanbulspor"],
  "Diyarbakırspor": ["Diyarbakirspor", "Dıyarbakır Spor"],
  "Karşıyaka": ["Karsiyaka", "Karşıyaka S.K."],
  "Sarıyer": ["Sarıyer SK", "Sariyer", "Sarıyer G.K."],
  "Ankara Keçiörengücü": ["Keçiörengücü"],
  "Gaziantep FK": ["Gaziantep", "Gaziantep BB", "Gazişehir Gaziantep", "Gaziantep B.B.", "Gaziantep F.K.", "Gaziantep B. Bel.spor", "Gaziantep BŞB", "Gaziantepspor"],
  "Bodrum FK": ["Bodrumspor", "Bodrum", "BB Bodrumspor", "Bodrum BB"],
  "Amedspor": ["Amed", "Amed S.K.", "FC Amed", "Amed Sportif Faaliyetler", "Diyarbakır BB"],
  "Çorum FK": ["Çorum", "Çorum F.K.", "Çorum Futbol Kulübü"],
  "Iğdır FK": ["Iğdır", "Iğdır F.K."],
  "Manisa FK": ["Manisa", "Manisa BB", "Manisa BBSK", "Manisa B.B."],
  "Manisaspor": ["Vestel Manisaspor", "Manisapor"],
  "Akhisarspor": ["Akhisar Belediyespor"],
  "Karabükspor": ["Kardemir Karabükspor"],
  "Kayseri Erciyesspor": ["Erciyesspor"],
  "Serikspor": ["Serik Belediyespor"],
  "Mersin İdmanyurdu": ["Mersin İdman Yurdu", "Mersin Idman Yurdu", "Mersin Idmanyurdu", "Mersin İY", "Mersin IY"],
  "Yeni Mersin İdmanyurdu": ["Yeni Mersin İY"],
  "Tarsus İdman Yurdu": ["Tarsus Idman Yurdu", "Tarsus İY", "Tarsus IY", "Tarsus İ.Y.", "Tarsus I.Y."],
  "Uşakspor": ["Usakspor", "Utaş Uşakspor"],
  "Yozgatspor": ["Yimpaş Yozgatspor", "Yimpas Yozgatspor"],
  "Aydınspor": ["Aydinspor"],
  "Bakırköyspor": ["Bakirköyspor"],
  "İskenderunspor": ["Iskenderunspor"],
  "İzmirspor": ["Izmirspor"],
  "Kırşehir Belediyespor": ["Kirsehir Belediyespor"],
  "Kırşehirspor": ["Kirsehirspor"],
  "Niğde Belediyespor": ["Nigde Belediyespor"],
  "Torbalıspor": ["Torbalispor"],
  "Bugsaşspor": ["Bugsas Spor", "Bugsaş Spor"],
  "Isparta 32 Spor": ["Isparta 32"],
  "Tavşanlı Linyitspor": ["TKİ Tavşanlı Linyitspor"],
  "Türk Telekomspor": ["Türk Telekom"],
  "Sivas Belediyespor": ["Sivas Belediye Spor", "Sivas Belediye"],
  "Konya Şekerspor": ["Konya Şeker"],
  "Anadolu Selçukspor": ["Konya Anadolu Selçukspor"],
  "Alibeyköyspor": ["Alibeyköy"],
  "Bayrampaşaspor": ["Bayrampaşa"],
  "Akçaabat Sebatspor": ["A. Sebatspor"],
  "Esenler Erokspor": ["Erokspor"],
  "Vefa": ["Vefa SK", "Vefa SC"],
  "Adalet": ["Adalet SK"],
  "Güneş": ["Güneş SK"],
  "Aliağa FK": ["Aliağa", "Aliaga FK"],
  "Dardanelspor": ["Dardanel Spor", "Dardanel Spor A.Ş.", "Çanakkale Dardanelspor"],
  "Kocaeli Birlik Spor": ["Kocaeli Birlikspor", "Kocaeli Birlik"],
  "Malatya Yeşilyurt Belediyespor": ["Malatya Yesilyurt Belediyespor"],
  "Polatlı 1926 SK": ["Polatli 1926 SK"],
  "Küçükçekmece Sinop Spor": ["Kücükcekmece Sinop Spor"],
  "Beykoz 1908": ["Beykoz 1908 SK"],
  "Bursa Merinosspor": ["Bursa Merinosspor AS"],
  "Menemen FK": ["Menemen", "Menemen Belediyespor", "Menemenspor"],
  "Barcelona": ["FC Barcelona"],
  "Real Madrid": ["Real Madrid Club de Fútbol"],
  "Bayern Munich": ["FC Bayern Munich"],
  "AC Milan": ["Milan", "A.C. Milan"],
  "Inter Milan": ["Internazionale", "Inter", "Ambrosiana-Inter"],
  "Roma": ["AS Roma", "A.S. Roma"],
  "Napoli": ["SSC Napoli"],
  "Fiorentina": ["ACF Fiorentina", "AC Fiorentina"],
  "Atalanta": ["Atalanta BC"],
  "Lazio": ["SS Lazio"],
  "Marseille": ["Olympique de Marseille"],
  "Lyon": ["Olympique Lyonnais"],
  "Monaco": ["AS Monaco"],
  "PSV": ["PSV Eindhoven"],
  "Schalke 04": ["FC Schalke 04"],
  "Bayer Leverkusen": ["Bayer 04 Leverkusen"],
  "Athletic Bilbao": ["Athletic Club"],
  "Benfica": ["S.L. Benfica"],
  "River Plate": ["Club Atlético River Plate"],
  "Arsenal": ["Woolwich Arsenal"],
  "AFC Bournemouth": ["Bournemouth"],
  "Monza": ["AC Monza"],
  "Paris Saint-Germain": ["Paris Saint Germain"],
  "Nantes": ["FC Nantes"],
  "Saint-Étienne": ["AS Saint-Étienne", "Saint-Etienne"],
  "SC Freiburg": ["Freiburg"],
  "SC Freiburg II": ["Freiburg II"],
  "FC Augsburg": ["Augsburg"],
  "Ajax": ["AFC Ajax"],
  "Porto": ["FC Porto"],
  "Metz": ["FC Metz"],
  "Lorient": ["FC Lorient"],
  "Le Havre": ["Le Havre AC"],
  "Sochaux": ["FC Sochaux"],
  "FC St. Pauli": ["St. Pauli"],
  "Hansa Rostock": ["FC Hansa Rostock"],
  "Pisa": ["Pisa SC"],
  "SPAL": ["Spal"],
  "St Mirren": ["St. Mirren"],
  "St Johnstone": ["St. Johnstone"],
  "Bayern Munich II": ["FC Bayern Munich II"],
  "Barcelona B": ["FC Barcelona B"],
  "Red Bull Salzburg": ["FC Red Bull Salzburg"],
  "Karlsruher SC": ["Karlsruher"],
  "Nîmes": ["Nimes"],
  "AlbinoLeffe": ["Albinoleffe"],
  "Südtirol": ["FC Südtirol"],
  "Bradford Park Avenue": ["Bradford (Park Avenue)"],
  "Torino": ["Torino FC"],
  "Ajaccio": ["AC Ajaccio"],
  "Cannes": ["AS Cannes"],
  "Troyes": ["Troyes AC"],
  "Amiens": ["Amiens SC"],
  "Cittadella": ["A.S. Cittadella", "AS Cittadella"],
};

// varyant metni -> kanonik (oyunda gösterilen) kulüp adı
const VARIANT_TO_CANONICAL = {};
for (const [canonical, variants] of Object.entries(CLUB_ALIAS_GROUPS)) {
  for (const v of variants) VARIANT_TO_CANONICAL[v] = canonical;
}

// Bir kulüp metnini kanonik adına çevirir. Bilinmeyen kulüpler aynen döner —
// yani bu fonksiyon HİÇBİR ZAMAN veri kaybettirmez, sadece bilinen varyantları
// tek bir isimde toplar.
export function canonicalClub(club) {
  return VARIANT_TO_CANONICAL[club] || club;
}

// Bir kulübün kanonik adı + bilinen bütün eski yazımları (logo araması gibi
// "herhangi biri tutarsa yeter" durumları için). İlk eleman her zaman kanonik.
export function kulupGrubu(club) {
  const k = canonicalClub(club);
  return [k, ...(CLUB_ALIAS_GROUPS[k] || [])];
}

// Bir oyuncunun kulüp listesini kanonik adlardan oluşan bir Set'e çevirir.
export function canonicalClubSet(clubs) {
  const s = new Set();
  for (const c of clubs) s.add(canonicalClub(c));
  return s;
}
