// Bazı kulüpler diğerlerinden çok daha "akla ilk gelen" takımlar — gerçek bir
// oyunda insanlar rastgele bir Anadolu kulübü değil, ağırlıklı olarak
// başarılı/büyük takımları söyler. Bu ağırlıklar round üretiminde
// kullanılıyor: yüksek ağırlıklı kulüplere bağlı oyuncular daha sık seçiliyor.
//
// Kademeli sistem: en tepede birkaç "mega" kulüp, sonra "büyük" kulüpler,
// sonra zaten sahip olduğumuz küratörlenmiş listelerin (5 Büyük Lig,
// Şampiyonlar Ligi, Türkiye üst 2 lig) TAMAMI orta seviye bir ağırlık alıyor
// — böylece Napoli, Sevilla, Dortmund gibi "süper ünlü ama mega değil"
// kulüpler de tamamen obskür bir kulüple aynı ağırlıkta kalmıyor.
import { BIG5_CLUBS, PREMIER_LEAGUE_CLUBS } from "./big5ClubTiers";
import { TOP2_TIER_CLUBS } from "./clubTiers";
import { PLAYER_LAST_ACTIVE_YEAR } from "./playerYears";
import { GLOBAL_STARS, TR_STARS } from "./starPlayers";

// 4 Eylül 2026: "5 Kulüp" modu (bkz. gameEngine.js generateFiveClubRound)
// bu üçünü DE dışa aktarıyor — o modda gösterilecek 5 kulüp, oyuncuların
// kolayca tanıyacağı bu havuzdan seçiliyor.
export const MEGA = ["Galatasaray", "Fenerbahçe", "Beşiktaş", "Real Madrid", "Barcelona", "Bayern Munich", "Manchester United", "Manchester City", "Liverpool", "Paris Saint-Germain"];
// 4 Eylül 2026: "Atletico Madrid" (aksansız) veri setinde HİÇBİR oyuncuyla
// eşleşmiyordu — players.json'daki gerçek kulüp adı aksanlı "Atlético
// Madrid". Bu, hem genel ağırlıklandırmayı hem de "5 Kulüp" modunun
// bağlantı analizini (scripts/club_connectivity.js) etkileyen sessiz bir
// hataydı: bu kulüp round'a düştüğünde ONUN için HİÇBİR oyuncu asla
// eşleşmiyordu. Ayrıca "Internazionale" ve "Inter Milan" veri setinde iki
// AYRI kulüp adı olarak duruyor (aynı kulübün iki farklı yazımı) — ikisi de
// bilerek burada tutuluyor, biri kaldırılırsa o isimle etiketlenmiş
// oyuncular tamamen görünmez olurdu.
export const BIG = ["Trabzonspor", "Chelsea", "Arsenal", "Juventus", "AC Milan", "Inter Milan", "Internazionale", "Atlético Madrid", "Borussia Dortmund", "Napoli"];
export const CHAMPIONS_LEAGUE_CLUBS = ["Ajax", "Porto", "Benfica", "Sevilla", "RB Leipzig", "Villarreal", "Shakhtar Donetsk", "Celtic"];

// 4 Eylül 2026 (12. tur, Kerem: "28 olan kulüp adedini arttırabiliriz, sen en
// iyi deneyim nasıl olur diyorsan öyle yap") — "5 Kulüp" modunun havuzunu
// genişletmek için players.json üzerinde çalıştırılan bağlantı analizinin
// (scripts/club_connectivity.js, artık silindi — çıktısı
// kulup_baglantisi_siralamasi_genis.csv'de duruyor) SONUÇLARINDAN seçildi.
// BİLİNÇLİ FİLTRE: analiz İtalyan/İngiliz ORTA SIRA takımlarını (Genoa,
// Torino, Parma, Empoli, Udinese gibi) salt SQUAD DERİNLİĞİ (çok sayıda
// sıradan transfer) yüzünden yüksek bağlantılı gösteriyordu — bunlar
// istatistiksel olarak "bağlantılı" olsa da modun ruhuna aykırı (Kerem: "5
// takım BÜYÜKÇE olmalı ki kolayca bulunabilsin"), bu yüzden pool'a
// EKLENMEDİ. Bunun yerine hem GERÇEKTEN tanıdık/büyük HEM DE analizde iyi
// bağlantılı çıkan kulüpler seçildi — İtalya'dan sadece Roma/Fiorentina/
// Atalanta/Lazio (hepsi gerçekten büyük/tanınmış), İngiltere'den üst-orta
// tabaka (Tottenham, Newcastle, West Ham, Everton, Aston Villa, Leicester —
// 2016 şampiyonu, tanıdıklık için), Fransa'dan Marsilya/Lyon/Monaco,
// İspanya'dan Real Sociedad/Valencia/Athletic Bilbao, Hollanda'dan
// Feyenoord/PSV, Portekiz'den Sporting, Almanya'dan Bayer Leverkusen/
// Schalke 04, ve GLOBAL çeşitlilik için Güney Amerika devleri (Boca
// Juniors, River Plate, Flamengo, Corinthians, Santos — Messi/Maradona/
// Pelé kültürüyle Türkiye'de de çok tanınıyorlar).
// NOT: Bazı kulüplerin veri setinde birden fazla yazımı var (ör.
// "Marseille" vs "Olympique de Marseille", "Monaco" vs "AS Monaco", "PSV"
// vs "PSV Eindhoven", "Roma" vs "AS Roma") — SADECE veri setinde daha SIK
// geçen (dolayısıyla daha çok oyuncuyu kapsayan) yazım seçildi, aksi halde
// aynı kulübün oyuncu havuzu ikiye bölünüp gereksiz yere zayıflardı.
export const WELL_KNOWN_EXTRA = [
  "Roma", "Fiorentina", "Atalanta", "Lazio",
  "Tottenham Hotspur", "Newcastle United", "West Ham United", "Everton", "Aston Villa", "Leicester City",
  "Marseille", "Lyon", "Monaco",
  "Real Sociedad", "Valencia", "Athletic Bilbao",
  "Feyenoord", "PSV",
  "Sporting CP",
  "Bayer Leverkusen", "Schalke 04",
  "Boca Juniors", "River Plate", "Flamengo", "Corinthians", "Santos",
];

const WEIGHT_MEGA = 9;
const WEIGHT_BIG = 5;
const WEIGHT_KNOWN = 2.5; // 5 Büyük Lig + Şampiyonlar Ligi + Türkiye üst 2 lig'in tamamı
const WEIGHT_DEFAULT = 1;

// "Arsenal" ile "Arsenal F.C." gibi ek uzantılı hâlleri aynı köke indirger.
// ÖNEMLİ: toLocaleLowerCase("tr-TR") KULLANMIYORUZ — Node'da bile 250 bin
// çağrıda ~8 kat daha yavaş ölçüldü (telefonun JS motorunda muhtemelen daha
// da yavaş), 43 bin oyuncunun her kulübü için çağrıldığında saniyeler
// süren donmaya yol açıyordu. Elle İ/I çevirisi + sade toLowerCase() aynı
// sonucu, çok daha hızlı veriyor.
function normalizeClubName(n) {
  return n
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLowerCase()
    .replace(/\s+(j\.?\s?k\.?|s\.?\s?k\.?|f\.?\s?k\.?|a\.?\s?ş\.?|gsk|f\.?\s?c\.?|c\.?\s?f\.?|a\.?\s?f\.?\s?c\.?)\.?$/i, "")
    .trim();
}

const CLUB_WEIGHTS = {};
for (const c of MEGA) CLUB_WEIGHTS[normalizeClubName(c)] = WEIGHT_MEGA;
for (const c of BIG) if (!CLUB_WEIGHTS[normalizeClubName(c)]) CLUB_WEIGHTS[normalizeClubName(c)] = WEIGHT_BIG;
for (const c of [...BIG5_CLUBS, ...PREMIER_LEAGUE_CLUBS, ...CHAMPIONS_LEAGUE_CLUBS, ...TOP2_TIER_CLUBS]) {
  const key = normalizeClubName(c);
  if (!CLUB_WEIGHTS[key]) CLUB_WEIGHTS[key] = WEIGHT_KNOWN;
}

// Bir oyuncunun (filtreden geçen) kulüpleri arasındaki EN YÜKSEK ağırlık —
// yani "Beşiktaş + bilinmeyen bir kulüp" oynamış biri, Beşiktaş'ın
// ağırlığından pay alır.
//
// Sonucu şeffaf bir Map'te ÖNBELLEKLİYORUZ: aynı kulüp listesi için ağırlık
// asla değişmez, ama lig seçimi her değiştiğinde computeRoundPool tüm 43
// bin oyuncu için bunu YENİDEN hesaplıyordu. Artık ikinci kez aynı oyuncu
// sorulunca hiç hesaplama yapılmadan önbellekten dönüyor.
const weightCache = new Map();

export function weightForClubs(clubs) {
  const cacheKey = clubs.join("|");
  const cached = weightCache.get(cacheKey);
  if (cached !== undefined) return cached;
  let max = WEIGHT_DEFAULT;
  for (const c of clubs) {
    const w = CLUB_WEIGHTS[normalizeClubName(c)];
    if (w && w > max) max = w;
  }
  weightCache.set(cacheKey, max);
  return max;
}

// --- Güncellik (recency) çarpanı ---
// Kulüp ünlü olsa bile ("Manchester United" gibi), veri setinde o kulübün
// 1960'lardan bugüne oynamış HERKESİ var. scripts/backfill_years.js
// çalıştırıldıysa (lib/playerYears.js doluysa), son yıllarda oynamış
// olanlar belirgin şekilde daha sık, eski dönem oyuncular gitgide daha
// nadir çıkıyor. Script hiç çalıştırılmadıysa (dosya boşsa) bu çarpan devre
// dışı kalır, sadece kulüp ünü kullanılır.
//
// Kademeler (Kerem'in belirttiği tam ölçek):
//   son 5 yıl   -> aşırı sık
//   son 10 yıl  -> çok sık
//   son 15 yıl  -> sık
//   son 20 yıl  -> normal
//   20+ yıl     -> her ek 5 yılda bir kademeli olarak gitgide seyrekleşir
const CURRENT_YEAR = new Date().getFullYear();

function recencyMultiplier(lastActiveYear) {
  if (!lastActiveYear) return 1; // veri yoksa (script çalışmadıysa ya da eşleşmediyse) nötr davran
  const age = CURRENT_YEAR - lastActiveYear;
  if (age <= 5) return 4.0; // aşırı sık
  if (age <= 10) return 2.2; // çok sık
  if (age <= 15) return 1.4; // sık
  if (age <= 20) return 1.0; // normal
  // 20 yıldan sonra: her ek 5 yılda ağırlık ~%55 azalır (üstel, gitgide
  // aşırı seyrekleşme hissi versin diye) — 0.02'nin altına inmiyor.
  const stepsOver20 = (age - 20) / 5;
  return Math.max(0.02, 1.0 * Math.pow(0.45, stepsOver20));
}

import { PLAYER_PHOTO_FILENAME } from "./playerPhotos";

// Kulüp ünü × güncellik — round üretiminde ve popülerliğe göre sıralamada
// KULLANILMASI gereken asıl fonksiyon budur, weightForClubs değil (o sadece
// kulüp tarafını hesaplıyor, tek başına eksik).
const playerWeightCache = new Map();

export function playerWeight(player) {
  const cached = playerWeightCache.get(player.name);
  if (cached !== undefined) return cached;
  const w = weightForClubs(player.clubs) * recencyMultiplier(PLAYER_LAST_ACTIVE_YEAR[player.name]);
  playerWeightCache.set(player.name, w);
  return w;
}

// ============================================================================
// 0-100 arası Popülerlik Puanı — 30 Ağustos 2026'da BAŞTAN TASARLANDI.
//
// ESKİ SİSTEMİN SORUNU (bkz. proje notları): Wikipedia görüntülenme verisi
// (lib/playerPopularity.json) yanlış/eşleşmemiş çıktı — Messi, Ronaldo,
// Mbappé, Haaland, Neymar hepsi 0 gösteriyordu, buna karşın rastgele bilinmeyen
// isimler yüz binlerce "görüntülenme" gösteriyordu. Bu yüzden bu dosya artık
// o veriyi KULLANMIYOR (playerPopularity.json hâlâ diskte duruyor ama bu
// fonksiyon ona bakmıyor — ileride düzgün/doğrulanmış bir kaynakla
// değiştirilebilir).
//
// İKİNCİ SORUN: Kulüp adına bakan bir sistem "Beşiktaş'ta 3 maça çıkmış
// oyuncu" ile "Beşiktaş'ın yıldızı"nı AYIRT EDEMEZ — ikisi de aynı kulüp
// adını taşır. Bu yüzden bu puanlama artık İKİ AYRI KATMAN kullanıyor:
//
//   1. HEURİSTİK KATMAN (küratörsüz TÜM oyuncular için): kulüp ünü +
//      güncellik + fotoğraf + Türkiye-4-büyükler bonusu + milli takım
//      bonusu. Bu katman KASITLI OLARAK 74 PUANDA TAVANLANIYOR — yani hiçbir
//      "sıradan ama büyük kulüpte oynamış" oyuncu, gerçek yıldızların
//      bulunduğu bölgeye sızamıyor.
//   2. KÜRATÖRLÜ KATMAN (lib/starPlayers.js): "şu an gerçekten ünlü"
//      oyuncuların elle girilmiş 75-100 arası puanı — bu iki dosya
//      (GLOBAL_STARS + TR_STARS) sezonda bir gözden geçirilip güncellenir
//      (bu sene Dembélé, seneye başka biri — starPlayers.js'teki rehbere
//      bak). Final puan = max(heuristik, küratörlü) — yani bir oyuncu her
//      iki şekilde de puan alabilir, hangisi yüksekse o geçerli olur.
//
// SONUÇ: difficulty=1 (en kolay/ısınma turu) eşiği 90 puan — bu eşiğin
// üzerine SADECE küratörlü listedeki gerçek yıldızlar çıkabiliyor, artık
// "Beşiktaş'ta oynamış bilinmeyen biri" değil. WhoAmI modu da aynı puana
// göre sıralandığı için aynı düzeltmeden faydalanıyor.
// ============================================================================

const HEURISTIC_CAP = 74;

const popularityCache = new Map();

export function calculatePlayerPopularity(player) {
  const cached = popularityCache.get(player.name);
  if (cached !== undefined) return cached;

  // --- 1. Heuristik katman ---
  // 31 Ağustos 2026 (Kerem: "ilhan fakılı ve nhaga ... ama hepsi 72 puanda",
  // sonra tekrar test edilince bu sefer HEPSİ 74 TAVANINDA toplandığı
  // görüldü) — asıl kök neden: eski ağırlıklar (45 kulüp + 15 recency +
  // 15 TR-büyük4 = 75) TEK BAŞINA tavanı (74) aşıyordu — yani "herhangi bir
  // Fenerbahçe/Galatasaray/Beşiktaş/Trabzon altyapı/yedek oyuncusu, yakın
  // zamanda oynamışsa" otomatik tavana çarpıyordu; milli takım/fotoğraf
  // bonusuna bile gerek kalmadan onlarca farklı oyuncu aynı 74'te
  // toplanıyordu. Aşağıdaki ağırlıklar bilerek küçültüldü — TÜM bonuslar
  // aynı anda üst üste binse bile (mega kulüp + tam güncellik + TR-büyük4 +
  // milli takım + foto + çok kulüplü kariyer) toplam tavanın (74) altında
  // kalıyor, böylece tavan sadece gerçekten HER kutuyu işaretleyen istisnai
  // profiller için anlamlı bir sınır oluyor, sıradan bir kombinasyon için
  // değil.
  let h = 0;

  // Kulüp şöhreti (0-38) — 31 Ağustos 2026: EN SON (güncel) kulübe göre
  // hesaplanıyor, KARİYER BOYUNCA en ünlü kulübe göre DEĞİL. clubs dizisi
  // kronolojik (ilk kulüp index 0, en son kulüp dizinin sonu) — bkz.
  // Haaland ["Bryne 2", ..., "Manchester City"], Kadir Arı ["Beşiktaş",
  // ...uzun bir alt lig kuyruğu..., "Kastamonuspor 1966"]. ESKİDEN buradaki
  // `weightForClubs` career-max (en yüksek ağırlıklı kulüp, HANGİ YAŞTA
  // oynanmış olursa olsun) kullanıyordu — bu, gençliğinde/altyapısında BİR
  // KEZ mega bir kulüpte (Beşiktaş/Galatasaray/Fenerbahçe/Trabzonspor) yer
  // almış ama kariyerinin geri kalanını küçük alt lig kulüplerinde geçirmiş
  // oyuncuların, güncellik bonusuyla birleşince (hâlâ alt ligde oynadıkları
  // için "aktif" sayılıyorlar) SIRADAN, GERÇEKTE POPÜLER OLMAYAN oyuncuların
  // güncel yıldızlarla/yeni transferlerle AYNI ya da DAHA YÜKSEK puana
  // çıkmasına yol açıyordu (Kerem: "ilhan fakılı ve nhaga ... hepsi aynı
  // puanda" şikayetinin asıl kök nedeni buydu). Kariyerinin doruğunda
  // gerçekten ünlenmiş ama artık küçük bir kulüpte olan oyuncular (Arda
  // Turan gibi) zaten KÜRATÖRLÜ KATMANDA (starPlayers.js) ayrıca
  // puanlanıyor, o yüzden bu katmanın "güncel kulübe göre" davranması
  // güvenli.
  const currentClub = Array.isArray(player.clubs) && player.clubs.length
    ? [player.clubs[player.clubs.length - 1]]
    : (player.clubs || []);
  const clubW = weightForClubs(currentClub);
  if (clubW === WEIGHT_MEGA) h += 38;
  else if (clubW === WEIGHT_BIG) h += 27;
  else if (clubW === WEIGHT_KNOWN) h += 17;
  else h += 7;

  // Fotoğrafı varsa (yani en azından Mackolik veya Wikipedia'da kayıtlı) — küçük sinyal
  if (PLAYER_PHOTO_FILENAME[player.name]) h += 3;

  // Güncellik — 31 Ağustos 2026 (Kerem: "ilhan fakılı ve nhaga, geçmişte
  // oynamış gençlere göre şu an çok daha popüler ama hepsi 72 puanda") —
  // ESKİDEN burada sadece 3 kademeli bir bonus vardı (+12/+8/+4/+0), yani
  // "son 5 yılda oynamış" HERKES (yeni bir transfer de, 4 yıl önce 2 maça
  // çıkıp kaybolmuş biri de) AYNI +12'yi alıyordu — bu da çok sayıda farklı
  // oyuncunun toplamda BİREBİR AYNI puana (ör. 72) düşmesine yol açan asıl
  // sebeplerden biriydi. Artık recencyMultiplier() (zaten round üretiminde
  // kullanılan, yaşa göre SÜREKLİ/keskin bir eğri) burada da kullanılıyor —
  // "şu an aktif" biri tam +15 alırken, 1-2 yıl önce bırakmış biri +15'e
  // yakın ama biraz daha az, 10 yıl önce bırakmış biri çok daha az alıyor.
  // Bu, aynı kova içindeki oyuncuları da birbirinden ayırıp toplam puanların
  // rastgele çakışma ihtimalini büyük ölçüde azaltıyor.
  const lastActiveYear = PLAYER_LAST_ACTIVE_YEAR[player.name];
  if (lastActiveYear) {
    h += 14 * Math.min(1, recencyMultiplier(lastActiveYear) / 4.0);
  }

  // 🇹🇷 Türkiye-4-büyükler ve diğer bilinen Türk kulüpleri bonusu — küçültüldü
  // (eskiden +40/+20, sonra +15/+8'di, tek başına yıldızları geride
  // bırakabiliyordu ve tavana çarpma sorununa katkı sağlıyordu) ama
  // KORUNDU: küratörsüz oyuncular arasında hâlâ belirleyici bir fark
  // yaratıyor. 31 Ağustos 2026: club-fame gibi bu bonus da artık kariyer
  // boyunca herhangi bir zaman değil, SADECE güncel (en son) kulübe bakıyor
  // — aynı "gençliğinde bir kez mega kulüpte oynamış journeyman" sorunu.
  const currentClubStr = typeof currentClub[0] === 'string' ? currentClub[0].toLowerCase() : (currentClub[0]?.name ? currentClub[0].name.toLowerCase() : '');
  const isTrBig4 = currentClubStr.includes('galatasaray') || currentClubStr.includes('fenerbah') || currentClubStr.includes('beşikt') || currentClubStr.includes('besikt') || currentClubStr.includes('trabzon');
  const isTrOther = currentClubStr.includes('bursaspor') || currentClubStr.includes('başakşehir') || currentClubStr.includes('sivasspor') || currentClubStr.includes('göztepe') || currentClubStr.includes('konyaspor') || currentClubStr.includes('antalyaspor') || currentClubStr.includes('kasımpaşa');
  if (isTrBig4) h += 9;
  else if (isTrOther) h += 5;

  // Milli Takım Bonusu (Sadece Türkler İçin)
  let nats = [];
  try {
    nats = require('./playerNationalTeams').PLAYER_NATIONAL_TEAMS[player.name] || [];
  } catch (e) {}
  if (nats.includes('Türkiye')) h += 6;

  // Kariyer genişliği — 31 Ağustos 2026 eklendi: aynı kovadaki (ör. "mega
  // kulüp + güncel") oyuncuları birbirinden ayıran KÜÇÜK bir ek sinyal.
  // Daha uzun/çok kulüplü bir kariyer, kesin bir ün ölçütü değil ama en
  // azından "aynı anda hem tavana yakın hem de birbirinin BİREBİR AYNISI"
  // olan oyuncu sayısını azaltıyor. Bilerek küçük tutuldu (en fazla +2).
  const clubCount = Array.isArray(player.clubs) ? player.clubs.length : 0;
  h += Math.min(2, clubCount * 0.15);

  h = Math.min(h, HEURISTIC_CAP);
  // İki ondalık basamağa yuvarla — tamsayıya yuvarlamak, sürekli (continuous)
  // güncellik katkısının kazandırdığı ayrıştırmayı geri kaybettirip farklı
  // oyuncuları yine aynı tamsayıda toplardı.
  h = Math.round(h * 100) / 100;

  // --- 2. Küratörlü katman ---
  const curated = GLOBAL_STARS[player.name] ?? TR_STARS[player.name] ?? null;

  const score = curated !== null ? Math.max(h, curated) : h;

  popularityCache.set(player.name, score);
  return score;
}

// ============================================================================
// TANINIRLIK PUANI — SADECE CEVAP EŞLEŞTİRMESİ İÇİN (11 Eylül 2026)
//
// NİYE AYRI BİR PUAN (Kerem: "ibrahimovic dedim, Zlatan'ı anlamadı, başka bir
// Ibrahimovic'i anladı"): Yukarıdaki calculatePlayerPopularity BİLEREK
// "ŞU AN kim popüler" ölçüyor — şöhreti EN SON kulübe bakarak hesaplıyor ve
// güncellik çarpanı uyguluyor. Tur üretimi için doğru olan bu. Ama CEVAP
// EŞLEŞTİRMESİ için yanlış: kullanıcı "ibrahimovic" dediğinde "şu an aktif
// olan Ibrahimovic"i değil, MEŞHUR olanı kastediyor.
//
//   Zlatan Ibrahimović   son kulüp LA Galaxy (ağırlık 1) + emekli  -> düşük
//   Arijon Ibrahimović   şu an Augsburg'da, aktif                  -> yüksek
//
// Bu yüzden eşleştirme KARİYERİN EN ÜNLÜ kulübüne bakıyor ve emekliliği
// cezalandırmıyor. Güncellik sadece küçük bir eşitlik bozucu olarak duruyor.
// Aynı düzeltme "sosa" (José Sosa) ve "savic" (Stefan Savić) gibi soyadla
// yapılan bütün aramaları da sağlamlaştırıyor.
// ============================================================================
const recognitionCache = new Map();

export function recognitionScore(player) {
  const cached = recognitionCache.get(player.name);
  if (cached !== undefined) return cached;

  const clubs = Array.isArray(player.clubs) ? player.clubs : [];
  // KARİYER BOYUNCA en yüksek ağırlıklı kulüp (calculatePlayerPopularity'nin
  // aksine "en son kulüp" DEĞİL).
  const careerW = weightForClubs(clubs);
  let s =
    careerW === WEIGHT_MEGA ? 60 :
    careerW === WEIGHT_BIG ? 45 :
    careerW === WEIGHT_KNOWN ? 28 : 10;

  // Uzun kariyer = daha çok maç, daha tanıdık isim.
  s += Math.min(8, clubs.length * 0.8);
  if (PLAYER_PHOTO_FILENAME[player.name]) s += 4;

  // Güncellik burada CEZA değil, sadece küçük bir eşitlik bozucu (en fazla +4).
  const sonYil = PLAYER_LAST_ACTIVE_YEAR[player.name];
  if (sonYil) s += 4 * Math.min(1, recencyMultiplier(sonYil) / 4.0);

  const curated = GLOBAL_STARS[player.name] ?? TR_STARS[player.name] ?? null;
  const score = curated !== null ? Math.max(s, curated) : s;

  recognitionCache.set(player.name, score);
  return score;
}
