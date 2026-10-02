// Yerel (pas-at) ve CPU modları için paylaşılan saf fonksiyonlar.
// NOT: Online modda bu dosya KULLANILMAZ — orada hakemlik ve doğrulama
// sunucuda (supabase/functions.sql) yapılır, istemci hile yapamaz.
import { weightForClubs, playerWeight, calculatePlayerPopularity, recognitionScore } from "./clubWeights";
import { PLAYER_NATIONAL_TEAMS } from "./playerNationalTeams";
import { PLAYER_NATIONALITY } from "./playerNationality";
import { PLAYER_BIRTH_POSITION } from "./playerBirthPosition";
import { PLAYER_LAST_ACTIVE_YEAR } from "./playerYears";
import { PLAYER_ACHIEVEMENTS } from "./playerAchievements";
let PLAYER_HINTS = {};
try { PLAYER_HINTS = require("./playerHints.json"); } catch (e) {}
import { PLAYER_PHOTO_FILENAME } from "./playerPhotos";
import { COUNTRY_TR, countryTr } from "./countryNamesTr";
import { positionTr } from "./positionNamesTr";
import { canonicalClub, canonicalClubSet, kulupGrubu, CLUB_ALIAS_GROUPS } from "./clubAliases";

export function normalize(str) {
  return str
    // 11 Eylül 2026 (Kerem: sesli olarak "kevin prince boateng" dedim
    // tanımadı) — KÖK NEDEN: veri setinde adı "Kevin-Prince Boateng"; aşağıdaki
    // "harf/rakam dışındakileri SİL" adımı tireyi yok edip adı
    // "kevinprince boateng" yapıyordu, kullanıcının söylediği ise
    // "kevin prince boateng" olduğu için eşleşme tutmuyordu. Tire/eğik çizgi
    // gibi ayırıcılar artık BOŞLUĞA çevriliyor (kesme işareti hâlâ siliniyor:
    // "M'Bemba" -> "mbemba" davranışı korunsun diye).
    .replace(/[-–—_/]/g, " ")
    .replace(/İ/g, "i")
    .replace(/ı/g, "i")
    .replace(/I/g, "i") // önceki adım İ'yi zaten i yaptı, kalan I'lar da i olsun (ayrıştırma amaçlı, dotless ı ayrımı burada önemli değil)
    .toLowerCase() // toLocaleLowerCase("tr-TR") DEĞİL — 43 bin oyuncu adında çağrıldığında (buildSuggestIndex) fark edilir bir yavaşlığa yol açıyordu
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // á, é, ç, ş, ü, č, ñ vb. — tüm aksanları genel olarak temizler
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}
// ============================================================================
// FONETİK ANAHTAR — Türkçe konuşanın yabancı ismi SÖYLEDİĞİ gibi yazması
//
// 12 Eylül 2026 (Kerem: "İspanya-Real Madrid için sesli olarak 'karvahal'
// dedim carvajal'i anlamadı" ve "courtois için 'kurtua' ve 'kortois' denedim
// anlamadı").
//
// Whisper duyduğunu Türkçe imlayla yazıyor; veri setinde ise özgün yazım var:
//     Carvajal  -> kullanıcı "karvahal"   (İspanyolca j = h, c = k)
//     Courtois  -> kullanıcı "kurtua"     (Fransızca ou = u, ois = ua, s okunmaz)
// Harf harf bakan normalize() bunları asla eşleştiremez.
//
// Bu fonksiyon hem veri setindeki adı hem kullanıcının söylediğini KABA BİR
// SES İSKELETİNE indiriyor; iki taraf da aynı dönüşümden geçtiği için özgün
// yazımı bilmeye gerek kalmıyor. Yazım farkı değil TELAFFUZ yakınlığı arıyor.
//
// Bilerek kaba: amaç mükemmel bir telaffuz modeli değil, aday listesi zaten
// küçükken (bir turun geçerli cevapları) yeterli ayrımı sağlamak. Eşleştirmede
// EN DÜŞÜK öncelikli katman olarak kullanılıyor — tam ad, soyad ve yazım
// benzerliği her zaman önce geliyor.
// ============================================================================
export function phoneticKey(str) {
  let t = normalize(str);
  if (!t) return "";
  t = t
    // İki harfli sesler önce
    .replace(/sch/g, "s")
    .replace(/ph/g, "f")
    .replace(/gh/g, "g")
    .replace(/th/g, "t")
    .replace(/sh/g, "s")
    .replace(/ch/g, "c")
    .replace(/cz/g, "c")
    .replace(/sz/g, "s")
    .replace(/zh/g, "j")
    .replace(/qu/g, "k")
    // Fransızca sesli birleşmeleri
    .replace(/eau/g, "o")
    .replace(/ou/g, "u")
    .replace(/oi/g, "ua")
    .replace(/au/g, "o")
    .replace(/ai/g, "e")
    // Tek harfler
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/w/g, "v")
    .replace(/y/g, "i")
    .replace(/j/g, "h")   // İspanyolca/Portekizce j ≈ Türkçe h (Carvajal -> karvahal)
    .replace(/c/g, "k")   // c ≈ k (Carvajal -> karvahal, Courtois -> kurtua)
    .replace(/z/g, "s")
    // Fransızca/Portekizce'de okunmayan son ünsüzler
    .replace(/([aeiou])[stxdz]\b/g, "$1")
    // Aynı harfin tekrarı tek sese iner
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return t;
}



// 4 Eylül 2026 — kulüp eşleşmesi artık KANONİK ada göre yapılıyor
// (bkz. lib/clubAliases.js): veri setinde aynı kulüp birden fazla yazımla
// geçebiliyor ("Inter Milan" / "Internazionale" / "Inter" gibi) ve düz
// `includes` bu oyuncuları GÖRMÜYORDU.
export function playersForPair(dataset, teamA, teamB) {
  const a = canonicalClub(teamA);
  const b = canonicalClub(teamB);
  return dataset.filter((p) => {
    const set = canonicalClubSet(p.clubs);
    return set.has(a) && set.has(b);
  });
}

// allowedClubs varken, "en az 2 onaylı kulübü olan" oyuncuları VE her birinin
// ağırlığını (büyük kulüplere bağlıysa VE yakın zamanda oynadıysa daha
// yüksek) bir kez hesaplıyoruz. Bunu her tur değil, SADECE lig seçimi
// değiştiğinde bir kez çağırman lazım (ekranlarda useMemo ile) — yoksa her
// turda binlerce oyuncuyu tekrar tekrar taramak performansı düşürür.
//
// Zorluk Modu (difficulty): 1'den 10'a kadar kademe.
// 1: Sadece efsaneler ve çok güncel yıldızlar (Pop >= 90)
// 10: Herkes (Pop >= 0)
//
// 30 Ağustos 2026 NOT: Bu sabit eşik dar bir lig/ülke filtresiyle (örn.
// "Süper Lig + 1. Lig") birleşince havuzu SIFIRLAYABİLİYORDU — küresel
// yıldızların hiçbiri o iki Türk kulübünde BİRDEN oynamamıştır, o yüzden
// "Pop >= 90" filtresi dar filtrelerde kimseyi geçirmeyebilir ("bu veri
// setiyle yeni eşleşme kalmadı" hatasına yol açıyordu). applyPopularityFloor
// bunu, havuz aşırı küçülürse o filtrenin KENDİ İÇİNDE en popüler oyunculara
// geri düşerek çözüyor — geniş/filtresiz modda davranış aynı kalıyor.
// 11 Eylül 2026 (Kerem: "5/10 zorluk seviyesi bayağı zordu. aslında 8-9-10'un
// zor olması lazım, 5-6-7 orta") — ESKİ SİSTEM SABİT PUAN EŞİĞİ kullanıyordu
// (threshold = 100 - difficulty*10). Sorun: puanlama "şu an büyük kulüpte ve
// aktif" olan HERKESE ~64 puan veriyor, yani eşik 50 (zorluk 5) Galatasaray'ın
// 19 yaşındaki yedeğini de içeri alıyordu. Ölçülen dağılım:
//     eşik 50 -> 431 oyuncu,  eşik 40 -> 968,  eşik 30 -> 4.660,
//     eşik 20 -> 20.485  (yani 5 ile 8 arasında 50 kat sıçrama)
// Eşik puanına göre değil, SIRALAMAYA göre çalışmak bu çarpıklığı tamamen
// ortadan kaldırıyor: zorluk artık "havuzun en tanınan %X'i" demek. Hem eğri
// düzgün, hem de dar bir lig filtresi seçildiğinde otomatik olarak o filtrenin
// KENDİ en tanınanlarına göre ölçekleniyor — eski koddaki "havuz boşalırsa
// %10'a geri düş" yaması da bu sayede gereksizleşti.
const DIFFICULTY_FRACTION = [
  0.0004, // 1  — sadece efsaneler
  0.0010, // 2
  0.0025, // 3
  0.0060, // 4
  0.0150, // 5  \
  0.0350, // 6   > orta
  0.0900, // 7  /
  0.2200, // 8  \
  0.5000, // 9   > zor
  1.0000, // 10 /  herkes
];

function applyPopularityFloor(filtered, difficulty) {
  if (!filtered || filtered.length === 0) return filtered;
  const d = Math.min(10, Math.max(1, Math.round(difficulty || 5)));
  if (d >= 10) return filtered;
  const oran = DIFFICULTY_FRACTION[d - 1];
  const adet = Math.max(8, Math.min(filtered.length, Math.ceil(filtered.length * oran)));
  if (adet >= filtered.length) return filtered;
  const sorted = [...filtered].sort(
    (a, b) => calculatePlayerPopularity(b) - calculatePlayerPopularity(a)
  );
  return sorted.slice(0, adet);
}


// ============================================================================
// EŞLEŞME PROFİLİ DESTEĞİ — 28 Eylül 2026 (bkz. lib/eslesmeProfili.js)
// computeRoundPool / computeCountryTeamPool ikinci parametre olarak ESKİ usul
// `allowedClubs` (Set ya da null) YA DA derlenmiş bir eşleşme profili alır.
// Profil gelirse: kapsamı allowedClubs gibi kullanılır, oyuncu ağırlığı profilin
// çarpanıyla çarpılır, tuttuğu takım hedeflenen oranda turlara girer. Havuz
// nesnesi profili taşır (pool.profil); generateRound kulüp çiftini de profile
// göre seçer.
// ============================================================================
function profilMi(x) {
  return !!(x && typeof x === "object" && typeof x.oyuncuCarpani === "function");
}
function kapsamOf(x) {
  return profilMi(x) ? x.kapsam : x;
}

// Havuz girdilerini (oyuncu + ağırlık) profil ağırlığı ve takım oranıyla kurar.
function havuzKur(filtered, profil) {
  const agirliklar = filtered.map((p) => {
    let w = playerWeight(p);
    if (profil) w *= profil.oyuncuCarpani(p);
    return w;
  });
  let tutulan = [];
  if (profil && profil.takim) {
    // Tuttuğu takımda oynamış oyuncuların toplam payını hedef orana çek.
    let T = 0, O = 0;
    filtered.forEach((p, i) => {
      if (p.clubs.some((c) => canonicalClub(c) === profil.takim)) { T += agirliklar[i]; tutulan.push(i); }
      else O += agirliklar[i];
    });
    const r = profil.takimOrani;
    if (T > 0 && O > 0 && r > 0 && T / (T + O) < r) {
      const f = (r * O) / ((1 - r) * T);
      for (const i of tutulan) agirliklar[i] *= f;
    }
  }
  let cumulative = 0;
  const entries = [];
  filtered.forEach((p, i) => {
    if (!(agirliklar[i] > 0)) return;
    cumulative += agirliklar[i];
    entries.push({ player: p, cumulative });
  });
  return { entries, total: cumulative, profil: profil || null };
}

export function computeRoundPool(dataset, allowedClubsOrProfil, difficulty = 5) {
  const profil = profilMi(allowedClubsOrProfil) ? allowedClubsOrProfil : null;
  const allowedClubs = kapsamOf(allowedClubsOrProfil);
  let filtered = allowedClubs
    ? dataset.filter((p) => p.clubs.filter((c) => allowedClubs.has(c)).length >= 2)
    : dataset;
  if (profil) filtered = filtered.filter((p) => profil.oyuncuCarpani(p) > 0);

  filtered = applyPopularityFloor(filtered, difficulty);
  return havuzKur(filtered, profil);
}

// Kulüp çifti seçimi: profil varsa kulüpler profil ağırlığıyla, tuttuğu takım
// oyuncunun kulüpleri arasındaysa çoğunlukla çiftin içinde.
function ciftSec(adaylar, profil) {
  if (!profil) {
    const k = [...adaylar].sort(() => Math.random() - 0.5);
    return [k[0], k[1]];
  }
  const kalan = [...adaylar];
  const secilen = [];
  if (profil.takim && Math.random() < 0.8) {
    const i = kalan.findIndex((c) => canonicalClub(c) === profil.takim);
    if (i >= 0) secilen.push(kalan.splice(i, 1)[0]);
  }
  while (secilen.length < 2 && kalan.length) {
    const w = kalan.map((c) => Math.max(0.05, profil.kulupCarpani(c)));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let j = 0;
    for (; j < w.length - 1; j++) { r -= w[j]; if (r <= 0) break; }
    secilen.push(kalan.splice(j, 1)[0]);
  }
  return Math.random() < 0.5 ? secilen : [secilen[1], secilen[0]];
}

// Ağırlıklı rastgele seçim: yüksek ağırlıklı (büyük kulüp) oyuncular daha
// sık seçilir — gerçek bir oyunda insanların ağırlıklı olarak büyük
// takımları söylemesi gibi.
function pickWeighted(pool) {
  if (pool.entries.length === 0) return null;
  const r = Math.random() * pool.total;
  // İkili arama yerine basit doğrusal tarama — havuz boyutunda bu hız farkı
  // hissedilmiyor (binlerce oyuncuda bile <1ms).
  for (const entry of pool.entries) {
    if (r <= entry.cumulative) return entry.player;
  }
  return pool.entries[pool.entries.length - 1].player;
}

export function generateRound(pool, dataset, usedPairs, allowedClubsOrProfil) {
  if (pool.entries.length === 0) return null;
  const profil = pool.profil || (profilMi(allowedClubsOrProfil) ? allowedClubsOrProfil : null);
  const allowedClubs = profil ? profil.kapsam : kapsamOf(allowedClubsOrProfil);
  for (let attempt = 0; attempt < 200; attempt++) {
    const player = pickWeighted(pool);
    // 3 Ekim 2026 (Kerem: "ilkay gündoğan demem için vfl bochum ii vs gs çıktı...
    // 2. takımların çıkmaması gerekiyor") — rezerv/altyapı takımları çifte hiç girmez.
    const candidateClubs = (allowedClubs ? player.clubs.filter((c) => allowedClubs.has(c)) : player.clubs).filter((c) => !rezervTakimMi(c));
    if (candidateClubs.length < 2) continue; // pool zaten filtreli ama güvenlik payı
    const [teamA, teamB] = ciftSec(candidateClubs, profil);
    const key = [teamA, teamB].sort().join("|");
    if (usedPairs.has(key)) continue;
    const validAnswers = playersForPair(dataset, teamA, teamB); // filtre uygulanmaz — çifte oynayan herkes geçerli cevap
    if (validAnswers.length === 0) continue;
    return { teamA, teamB, validAnswers, key };
  }
  return null;
}

const MIN_PREFIX_LEN = 3;

// 26 Eylül 2026 (Kerem: "mikrofonlu cevaplarda performans düştü") — eskiden
// her çağrıda (m+1)x(n+1) boyutlu iç içe dizi ayırıyordu; 5 Kulüp modunda
// cevap 46 bin oyuncuya karşı denendiği için bu tek başına saniyeler
// sürüyordu. Aynı algoritma, sadece iki satırlık tamponla (sonuç birebir aynı).
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let onceki = new Array(n + 1);
  let simdiki = new Array(n + 1);
  for (let j = 0; j <= n; j++) onceki[j] = j;
  for (let i = 1; i <= m; i++) {
    simdiki[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const x = onceki[j] + 1, y = simdiki[j - 1] + 1, z = onceki[j - 1] + cost;
      simdiki[j] = x < y ? (x < z ? x : z) : (y < z ? y : z);
    }
    const t = onceki; onceki = simdiki; simdiki = t;
  }
  return onceki[n];
}

// SQL tarafındaki pg_trgm'in JS karşılığı: küçük yazım hatalarını (harf
// eksik/fazla/yer değişmiş) tolere eder, ama alakasız ya da farklı-ama-
// benzer-görünen isimleri (Ronaldo/Ronaldinho gibi) yanlışlıkla kabul etmez.
function isCloseEnough(a, b) {
  if (a.length < 4 || b.length < 4) return false;
  // Uzunluk farkı tek başına eşiği aşıyorsa Levenshtein'a hiç gerek yok
  // (mesafe en az uzunluk farkı kadardır) — büyük listelerde çoğu aday burada elenir.
  const uzun = Math.max(a.length, b.length);
  if (Math.abs(a.length - b.length) / uzun >= 0.25) return false;
  const dist = levenshtein(a, b);
  return dist / Math.max(a.length, b.length) < 0.25;
}

// Eşleşen oyuncuyu (nesnenin kendisini) döndürür — sadece doğru/yanlış değil,
// TAM OLARAK hangi oyuncuyla eşleştiğini bilmemiz lazım (fotoğraf göstermek
// gibi işler için, kullanıcının yazdığı kısaltma/soyadı değil, oyuncunun
// kendi kanonik adı gerekiyor).
// 4 Eylül 2026 (Kerem: "sosa dedim, Borne Sosa olarak algıladı" / "sosa yazıp
// en üstteki öneriye tıkladım, José Lasa kabul etti") — KÖK NEDEN BULUNDU:
// bu fonksiyon `validAnswers.find(...)` kullanıyordu, yani veri setinde
// ALFABETİK olarak İLK denk gelen oyuncuyu döndürüyordu — eşleşmenin NE KADAR
// İYİ olduğuna hiç bakmadan. İki somut sonucu vardı:
//   • "sosa" yazınca, soyadı Sosa olan ünlü José Sosa yerine listede daha
//     önce gelen obskür "Borne Sosa" seçiliyordu.
//   • "José Sosa" TAM ADI gönderildiğinde bile, alfabetik olarak daha önce
//     gelen "José Lasa" BULANIK (Levenshtein) eşleşmeden geçiyordu
//     ("jose lasa" ↔ "jose sosa" = 2 harf fark, %22 < %25 eşik) ve TAM AD
//     eşleşmesi hiç denenmeden kazanıyordu.
// ÇÖZÜM: artık tüm aday eşleşmeler KALİTE KADEMESİNE göre puanlanıyor
// (1 = tam ad, 2 = tam kelime/soyadı, 3 = ad+soyad, 4 = ön ek, 5 = ad-sonrası
// kısım, 6 = bulanık), en iyi kademe seçiliyor ve AYNI kademede birden fazla
// aday varsa POPÜLERLİĞİ yüksek olan kazanıyor. Böylece "sosa" → José Sosa,
// tam ad gönderildiğinde de her zaman o oyuncunun kendisi geliyor.
// Fonetik katman: "karvahal" -> Carvajal, "kurtua" -> Courtois.
// EN DÜŞÜK öncelikli katman; sadece yukarıdaki hiçbir kural tutmadığında
// devreye giriyor. Kısa girdilerde (4 harften az) hiç denenmiyor — "ali"
// gibi bir şey her şeye benzer.
// Oyuncu adının normalize/fonetik hâli her aramada yeniden hesaplanmasın diye
// oyuncu NESNESİNE bağlı önbellek (WeakMap: oyuncu silinirse kayıt da gider).
const _adOnbellek = new WeakMap();
function adBilgisi(p) {
  let b = _adOnbellek.get(p);
  if (!b) {
    const full = normalize(p.name);
    b = { full, tokens: full.split(" "), ses: undefined, takma: takmaAdlari(p.name) };
    _adOnbellek.set(p, b);
  }
  return b;
}
function adSesi(p) {
  const b = adBilgisi(p);
  if (b.ses === undefined) b.ses = phoneticKey(p.name);
  return b.ses;
}

function sesEsleser(girdiSes, girdiTokenlari, ad, hazirAdSes) {
  if (girdiSes.length < 4) return false;
  const adSes = hazirAdSes !== undefined ? hazirAdSes : phoneticKey(ad);
  if (!adSes) return false;
  if (girdiSes === adSes) return true;
  const adTokenlari = adSes.split(" ");
  // Soyadı (ya da herhangi bir parça) telaffuzla tutuyorsa kabul.
  for (const t of adTokenlari) {
    if (t.length < 4) continue;
    if (t === girdiSes) return true;
    if (isCloseEnough(girdiSes, t)) return true;
  }
  // Kullanıcı birden çok kelime söylediyse ad+soyad iskeleti
  if (girdiTokenlari.length >= 2 && adTokenlari.length >= 2) {
    if (
      girdiTokenlari[0] === adTokenlari[0] &&
      girdiTokenlari[girdiTokenlari.length - 1] === adTokenlari[adTokenlari.length - 1]
    ) return true;
  }
  return isCloseEnough(girdiSes, adSes);
}

// ============================================================================
// TEK İSİMLİ OYUNCULARIN TAM ADLARI — 27 Eylül 2026
// Kerem: "alex de souza diyince alex'i anlamıyor". Veri setinde Brezilya/
// İspanya/Portekiz geleneğiyle tek isimle kayıtlı oyuncular var ("Alex",
// "Kaká", "Xavi"); kullanıcı ise tam adını söylüyor. İki katman:
//   1) Elle yazılmış takma adlar (aşağıdaki liste, normalize edilmiş hâlde).
//   2) Genel kural: veri setindeki ad TEK kelimeyse, söylenen ilk kelime o ad
//      ve söylenenin içinde "de/da/do/dos/das" gibi bir bağlaç varsa kabul
//      ("alex de souza", "kaka dos santos"). Bağlaç şartı, "Alex Telles"
//      gibi BAŞKA bir oyuncunun adının yanlışlıkla "Alex"e eşlenmesini önlüyor.
// ============================================================================
export const TEK_ISIM_TAKMA_ADLARI = {
  "Alex": ["alex de souza", "alexsandro de souza"],
  "Neymar": ["neymar jr", "neymar junior", "neymar da silva"],
  "Ronaldinho": ["ronaldinho gaucho", "ronaldo de assis"],
  "Ronaldo": ["ronaldo nazario", "ronaldo luis nazario", "r9"],
  "Kaká": ["ricardo kaka", "ricardo izecson"],
  "Raúl": ["raul gonzalez"],
  "Romário": ["romario de souza"],
  "Rivaldo": ["rivaldo ferreira"],
  "Cafu": ["marcos cafu"],
  "Pedri": ["pedro gonzalez"],
  "Rodri": ["rodrigo hernandez"],
  "Xavi": ["xavi hernandez"],
  "Deco": ["anderson deco", "deco souza"],
  "Nani": ["luis nani", "nani cunha"],
  "Marquinhos": ["marcos aoas"],
  "Fabinho": ["fabio tavares"],
  "Isco": ["isco alarcon", "francisco alarcon"],
  "Juanfran": ["juan francisco torres"],
  "Pauleta": ["pedro pauleta"],
  "Zico": ["arthur zico"],
  "Talisca": ["anderson talisca"],
  "Elano": ["elano blumer"],
  "Lúcio": ["lucimar da silva"],
};
const BAGLACLAR = new Set(["de", "da", "do", "dos", "das", "di", "del"]);

// ============================================================================
// ÇİFT KAYITLARDAN GELEN TAKMA ADLAR — 28 Eylül 2026
// Kerem: "81 çift kayıt ... evet ama iki isimle de eşleşebilmeli. dani alves
// diyince anlamalı mesela." Aynı oyuncunun iki kaydı (ör. "Dani Alves" +
// "Daniel Alves") tek kayda indirildi; silinen yazımlar lib/playerAliases.json'da
// tutulan adın takma adı olarak duruyor. Hem yazılı/sesli cevapta hem öneri
// kutusunda iki yazım da tanınıyor.
// ============================================================================
let _ciftTakma = null;
function ciftTakmaAdlari() {
  if (_ciftTakma) return _ciftTakma;
  try { _ciftTakma = require("./playerAliases.json") || {}; } catch (e) { _ciftTakma = {}; }
  if (_ciftTakma && _ciftTakma.default && typeof _ciftTakma.default === "object") _ciftTakma = _ciftTakma.default;
  return _ciftTakma;
}
const _takmaOnbellek = new Map();
// Bir oyuncunun normalize edilmiş bütün takma adları (elle yazılanlar + çift kayıtlar).
export function takmaAdlari(ad) {
  let l = _takmaOnbellek.get(ad);
  if (l) return l;
  l = [...(TEK_ISIM_TAKMA_ADLARI[ad] || []), ...(ciftTakmaAdlari()[ad] || []).map(normalize)];
  _takmaOnbellek.set(ad, l);
  return l;
}

function takmaAdTutar(ad, n) {
  return takmaAdlari(ad).includes(n);
}

function tekIsimTamAd(adTokenlari, girdiTokenlari) {
  return (
    adTokenlari.length === 1 &&
    girdiTokenlari.length >= 2 &&
    girdiTokenlari[0] === adTokenlari[0] &&
    girdiTokenlari.slice(1).some((t) => BAGLACLAR.has(t))
  );
}

export function findMatchedPlayer(input, validAnswers) {
  const n = normalize(input);
  if (!n) return null;
  const inputTokens = n.split(" ");
  // 12 Eylül 2026 — sesli cevaplarda Türkçe okunuş katmanı (bkz. phoneticKey).
  const nSes = phoneticKey(input);
  const sesTokenlari = nSes ? nSes.split(" ") : [];

  // 11 Eylül 2026 (Kerem: "ibrahimovic dedim Zlatan'ı anlamadı, başka bir
  // Ibrahimovic'i anladı") — eşitlik bozucu artık calculatePlayerPopularity
  // DEĞİL, recognitionScore (bkz. clubWeights.js). Birincisi "şu an kim
  // popüler"i ölçüyor ve emekli efsaneleri son kulüplerine göre cezalandırıyor;
  // cevap eşleştirmesinde gereken ise "kim meşhur".
  let best = null; // { player, tier, pop }
  for (const p of validAnswers) {
    const { full, tokens } = adBilgisi(p);

    let tier = 0;
    if (n === full) tier = 1;
    else if (tokens.includes(n) || takmaAdTutar(p.name, n)) tier = 2;
    else if (tekIsimTamAd(tokens, inputTokens)) tier = 3;
    else if (
      inputTokens.length >= 2 &&
      tokens.length >= 2 &&
      inputTokens[0] === tokens[0] &&
      inputTokens[inputTokens.length - 1] === tokens[tokens.length - 1]
    ) tier = 3;
    else if (n.length >= MIN_PREFIX_LEN && tokens.some((t) => t.startsWith(n))) tier = 4;
    else if (tokens.length >= 3 && n === tokens.slice(1).join(" ")) tier = 5;
    else if (isCloseEnough(n, full) || takmaAdlari(p.name).some((t) => isCloseEnough(n, t))) tier = 6;
    else if (nSes && sesEsleser(nSes, sesTokenlari, p.name, adSesi(p))) tier = 7;
    else continue;

    // Tam ad eşleşmesinde daha iyisi olamaz — hemen dön (performans).
    if (tier === 1) return p;

    if (!best || tier < best.tier) {
      best = { player: p, tier, pop: recognitionScore(p) };
      continue;
    }
    if (tier === best.tier) {
      const pop = recognitionScore(p);
      if (pop > best.pop) best = { player: p, tier, pop };
    }
  }
  return best ? best.player : null;
}


export function findMatchedTeam(input, allClubs) {
  const n = normalize(input);
  if (!n) return null;

  // 26 Eylül 2026: kulüp varyantları birleşti — oyuncu eski/uzun adı yazarsa
  // ("İstanbul Başakşehir", "Rizespor", "Internazionale") kanonik kulübe git.
  const takmaAd = takmaAdHaritasi().get(n);
  if (takmaAd && allClubs.includes(takmaAd)) return takmaAd;
  
  let bestMatch = null;
  let bestDist = 999;

  for (const c of allClubs) {
    const full = normalize(c);
    if (n === full) return c; // exact match wins immediately
    if (full.startsWith(n) && n.length >= 4) {
      return c; 
    }
    const dist = levenshtein(n, full);
    // threshold: 1 error per 4 chars
    if (dist <= Math.floor(n.length / 4) + 1 && dist < bestDist) {
      bestDist = dist;
      bestMatch = c;
    }
  }
  return bestMatch;
}

// ============================================================================
// KULÜP ÖNERİLERİ — 12 Eylül 2026'da baştan yazıldı.
//
// Kerem: "barce yazıyorum 'barcellona' isimli bir kulüp en üstte çıkıyor.
// a2-u21 gibi ekleri olan takımlar önerilmemeli. galatasaray dendiyse
// bildiğimiz galatasaray olacak sadece."
//
// ESKİ HÂLİ: CLUB_INFO anahtarlarını sırasız substring filtresinden geçirip
// ilk 5'i veriyordu. Sıralama yoktu, o yüzden yazım hatası olan kayıtlar
// ("Barcellona") gerçek kulübün üstüne çıkabiliyordu; rezerv ve altyapı
// takımları da ("Galatasaray A2", "Barcelona U19", "Jong Ajax") normal
// kulüplerle aynı listede duruyordu.
//
// YENİ HÂLİ: rezerv/altyapı/kadın takımları eleniyor, kalanlar veri
// setindeki OYUNCU SAYISINA göre sıralanıyor (gerçek bir popülerlik vekili:
// büyük kulüplerin kaydı çok daha kalabalık), ve adın BAŞINDAN eşleşenler
// içinden geçenlerin üstüne konuyor.
// ============================================================================

// Rezerv / altyapı / kadın takımı desenleri. Elemek istediğimiz şey, kullanıcı
// "galatasaray" yazdığında listede beliren "Galatasaray A2" türü kayıtlar.
const REZERV_DESENLERI = [
  /\bA2\b/i,
  /\bU-?(1[0-9]|2[0-3])\b/i,           // U19, U-21, U23
  /\b(II|III)\b/,                      // "Bayern Munich II"
  /\b[BC]\b/,                          // "Porto B", "Sevilla C"
  /\b\d\b$/,                            // "Strømsgodset 2"
  /\b(youth|reserves?|academy|akademi|altyap[ıi])\b/i,
  /\b(women|women's|ladies|kad[ıi]n)\b/i,
  /^Jong\s/i,                           // Hollanda rezerv takımları: "Jong Ajax"
  /\bamateur[es]?\b/i,
  // 12 Eylül 2026 — ilk turda hâlâ sızan rezerv takımlar. Her biri veri
  // setinde tek tek doğrulandı.
  /\bPAF\b/i,                           // "Fenerbahçe PAF"
  /\bCastilla\b/i,                      // "Real Madrid Castilla"
  /\((A|B|C|II)\)/i,                    // "Bayern Munich (A)"
  /\bU-?2[0-3]\b/i,                     // "Juventus U23"
  /\bSub-?2[0-3]\b/i,
  /\bPromesas\b/i,
  // NOT: genel bir /Atlètic/ deseni KULLANMIYORUZ — "Atlètic d'Escaldes"
  // Andorra'nın gerçek bir birinci takımı. Sadece Barcelona'nın rezervi
  // adıyla eleniyor.
  /^(FC\s+)?Barcelona\s+Atl[eè]tic$/i,
];

// Adında "II" geçen ama gerçek birinci takım olan kulüpler.
const REZERV_DEGIL = new Set(["Willem II"]);
export function rezervTakimMi(ad) {
  if (!ad) return false;
  if (REZERV_DEGIL.has(ad)) return false;
  return REZERV_DESENLERI.some((d) => d.test(ad));
}

// normalize(eski yazım) -> kanonik ad. İlk kullanımda bir kez kuruluyor.
let _takmaAdlar = null;
function takmaAdHaritasi() {
  if (_takmaAdlar) return _takmaAdlar;
  _takmaAdlar = new Map();
  for (const [kanonik, varyantlar] of Object.entries(CLUB_ALIAS_GROUPS)) {
    for (const v of varyantlar) {
      const n = normalize(v);
      if (n && n !== normalize(kanonik)) _takmaAdlar.set(n, kanonik);
    }
  }
  return _takmaAdlar;
}

// clubsList: kulüp adları dizisi (CLUB_INFO anahtarları gibi)
// dataset   : players.json — popülerlik için oyuncu sayısı buradan sayılıyor
export function buildClubSuggestIndex(clubsList, dataset) {
  const sayac = new Map();
  if (dataset) {
    for (const p of dataset) {
      const kulupler = p.clubs || [];
      for (const c of kulupler) sayac.set(c, (sayac.get(c) || 0) + 1);
    }
  }
  const index = [];
  for (const c of clubsList) {
    if (rezervTakimMi(c)) continue;
    const oyuncu = sayac.get(c) || 0;
    // Veri setinde hiç oyuncusu olmayan kayıtlar (yazım hatası, kapanmış
    // kulüp, alakasız kayıt) öneri listesine hiç girmiyor — "Barcellona"
    // tam olarak bu gruptaydı.
    if (dataset && oyuncu === 0) continue;
    // takmaAdlar: "istanbul basaksehir" yazan da Başakşehir önerisini görsün
    const takmaAdlar = kulupGrubu(c).slice(1).map(normalize);
    index.push({ original: c, normalized: normalize(c), takmaAdlar, oyuncu });
  }
  index.sort((a, b) => b.oyuncu - a.oyuncu);
  return index;
}

export function suggestClubs(index, input, limit = 5) {
  const n = normalize(input);
  if (!n || n.length < 2) return [];
  const bastan = [];
  const icinde = [];
  for (const item of index) {
    const ta = item.takmaAdlar || [];
    if (item.normalized.startsWith(n) || ta.some((t) => t.startsWith(n))) bastan.push(item.original);
    else if (item.normalized.includes(n) || ta.some((t) => t.includes(n))) icinde.push(item.original);
    if (bastan.length >= limit) break;
  }
  return bastan.concat(icinde).slice(0, limit);
}

export function generateDraftRound(teamA, dataset, usedPairs, allowedClubs, difficulty = 5) {
  let players = dataset.filter(p => p.clubs.includes(teamA));
  if (allowedClubs) {
    players = players.filter(p => p.clubs.some(c => c !== teamA && allowedClubs.has(c)));
  }
  if (players.length === 0) return null;

  // Tüm olası TeamB'leri ve ortak oyuncu sayılarını bulalım
  const teamBCounts = {};
  players.forEach(p => {
    p.clubs.forEach(c => {
      if (c !== teamA && (!allowedClubs || allowedClubs.has(c))) {
        teamBCounts[c] = (teamBCounts[c] || 0) + 1;
      }
    });
  });

  const candidates = Object.keys(teamBCounts).map(b => ({
    teamB: b,
    count: teamBCounts[b]
  })).filter(c => !rezervTakimMi(c.teamB) && !usedPairs.has([teamA, c.teamB].sort().join("|")));

  if (candidates.length === 0) return null;

  // Zorluğa göre sıralayalım.
  // Kolay (1-4): En çok ortak oyuncusu olanları üste al.
  // Zor (8-10): En az ortak oyuncusu olanları (1-2) üste al.
  candidates.sort((a, b) => {
    if (difficulty <= 4) return b.count - a.count; // azalan
    if (difficulty >= 8) return a.count - b.count; // artan
    // Orta seviye (5-7): Rastgele dağıt, ama yine de çok az olanları (1) sona itebiliriz
    return Math.random() - 0.5;
  });

  // En iyi adaylardan (ilk 5-10) rastgele birini seç
  const topN = candidates.slice(0, Math.min(10, candidates.length));
  const picked = topN[Math.floor(Math.random() * topN.length)];

  const teamB = picked.teamB;
  const key = [teamA, teamB].sort().join("|");
  const validAnswers = playersForPair(dataset, teamA, teamB);
  
  // Picked player (for result display)
  const pickedPlayer = validAnswers[Math.floor(Math.random() * validAnswers.length)];

  return { teamA, teamB, validAnswers, key, pickedPlayer };
}

// ============================================================================
// SESLİ CEVAP İÇİN WHISPER İPUÇLARI — 26 Eylül 2026
// Kerem: "bu isim listede bulunamadı diyor... eğer bu oyuncuya kopya
// veriyorsa kaldırmamız lazım." Eskiden Whisper'a ipucu olarak SADECE bu
// turun DOĞRU cevapları gidiyordu. Whisper ipucundaki isimlere doğru "çekildiği"
// için, oyuncu yanlış ama benzer bir isim söylediğinde onay ekranında DOĞRU
// cevabın adı yazabiliyordu — yani kopya. Artık ipucu, turdaki kulüplerin
// (iki takımdan herhangi birinde oynamış) en tanınmış oyuncularından
// sırayla karışık seçiliyor: doğru cevaplar da içinde ama bir o kadar da
// yanlış aday var, ipucu listesi cevabı ele vermiyor.
// ============================================================================
let _kulupOyunculari = null;
function kulupOyunculari(dataset) {
  if (_kulupOyunculari && _kulupOyunculari.veri === dataset) return _kulupOyunculari.harita;
  const harita = new Map();
  for (const p of dataset) {
    for (const c of canonicalClubSet(p.clubs || [])) {
      let l = harita.get(c);
      if (!l) { l = []; harita.set(c, l); }
      l.push(p);
    }
  }
  _kulupOyunculari = { veri: dataset, harita, sirali: new Set() };
  return harita;
}

export function sesIpuclari(dataset, takimlar, limit = 30) {
  if (!dataset || !takimlar) return [];
  const harita = kulupOyunculari(dataset);
  const listeler = [];
  for (const t of takimlar) {
    if (!t) continue;
    const k = canonicalClub(t);
    const l = harita.get(k);
    if (!l) continue;
    if (!_kulupOyunculari.sirali.has(k)) {
      l.sort((a, b) => recognitionScore(b) - recognitionScore(a));
      _kulupOyunculari.sirali.add(k);
    }
    listeler.push(l);
  }
  const cikti = [];
  const gorulen = new Set();
  for (let i = 0; cikti.length < limit; i++) {
    let devam = false;
    for (const l of listeler) {
      if (i >= l.length) continue;
      devam = true;
      const ad = l[i].name;
      if (!gorulen.has(ad)) { gorulen.add(ad); cikti.push(ad); }
      if (cikti.length >= limit) break;
    }
    if (!devam) break;
  }
  return cikti;
}

export function isCorrectAnswer(input, validAnswers) {
  return findMatchedPlayer(input, validAnswers) !== null;
}

export const ROUND_SECONDS = 10; // varsayılan, artık ekrandan seçilebiliyor
export const ANSWER_SECONDS = 12;
export const ROUND_TIME_OPTIONS = [8, 10, 15];

// Öneri kutusu için: her tuşa basışta tüm veri setini yeniden normalize
// etmemek adına, bunu component mount olduğunda BİR KEZ hesaplayıp
// (useMemo ile) suggestPlayers'a hazır index olarak veriyoruz.
export function buildSuggestIndex(dataset) {
  // Popülerliğe göre sıralayarak indeks oluşturuyoruz. Böylece arama 
  // çubuğunda/önerilerde her zaman önce ünlü (ve muhtemelen fotoğraflı) 
  // oyuncular çıkacak. Obskür oyuncular sadece tam adı yazıldığında altta çıkacak.
  return dataset
    .map((p) => ({ 
      name: p.name, 
      normalized: normalize(p.name), 
      takma: takmaAdlari(p.name).length ? takmaAdlari(p.name) : null,
      pop: calculatePlayerPopularity(p) 
    }))
    .sort((a, b) => b.pop - a.pop);
}

// Yazarken canlı öneri — round'un DOĞRU CEVAPLARINA değil, tüm veri setine
// bakıyor. Böylece hile olmuyor (hangi isimlerin bu tur için geçerli
// olduğunu göstermiyor), sadece isim yazmaya/hatırlamaya yardımcı oluyor.
export function suggestPlayers(index, query, limit = 5) {
  const n = normalize(query);
  if (!n || n.length < 2) return [];
  const seen = new Set();
  const results = [];
  for (const item of index) {
    if (results.length >= limit) break;
    if (seen.has(item.name)) continue;
    // 27 Eylül 2026 (Kerem: "van yazınca çıkan tahmin van p yazınca çıkmıyor")
    // — çok kelimeli yazımda (ör. "van p") eskiden sadece TEK kelimenin başına
    // bakılıyordu. Artık yazılan metin adın herhangi bir kelimesinden
    // başlayan bir parçasıysa da ("robin VAN P..."), ya da tek isimli
    // oyuncunun tam adıysa ("alex de s..." -> Alex) öneriliyor.
    const matches =
      item.normalized.startsWith(n) ||
      item.normalized.split(" ").some((t) => t.startsWith(n)) ||
      (n.includes(" ") && (" " + item.normalized).includes(" " + n)) ||
      (item.takma ? item.takma.some((t) => t.startsWith(n)) : false);
    if (matches) {
      results.push(item.name);
      seen.add(item.name);
    }
  }
  return results;
}

export function getCpuProfile(difficulty) {
  const correctChance = 0.40 + ((difficulty - 1) / 9) * 0.55;
  const minDelay = 6000 - ((difficulty - 1) / 9) * 5500;
  const maxDelay = 10000 - ((difficulty - 1) / 9) * 8000;
  return { minDelay, maxDelay, correctChance };
}

// Hızlı Oyun modu için: klasik generateRound ile aynı takım çiftini bulur,
// ama tek bir doğru cevap + 3 "makul" yanlış seçenek (aynı lig havuzundan,
// gerçekten bu turun cevabı OLMAYAN oyuncular) üretir.
export function generateQuickRound(pool, dataset, usedPairs, allowedClubs, depth = 0) {
  if (depth > 50) return null;
  const base = generateRound(pool, dataset, usedPairs, allowedClubs);
  if (!base) return null;

  // Hızlı oyun modunda ekranda şık durması ve "obskür/salak" oyunculardan
  // arındırılmış olması için SADECE fotoğrafı olan oyuncuları doğru cevap
  // yapmaya zorluyoruz. (Aksi takdirde 2 dev kulüpte oynamış 1960'lardan bir yedek kaleci çıkabiliyor)
  const photogenicAnswers = base.validAnswers.filter((p) => PLAYER_PHOTO_FILENAME[p.name]);
  
  if (photogenicAnswers.length === 0) {
    const newUsed = new Set(usedPairs);
    newUsed.add(base.key);
    return generateQuickRound(pool, dataset, newUsed, allowedClubs, depth + 1);
  }

  const correctPlayer = photogenicAnswers[Math.floor(Math.random() * photogenicAnswers.length)];
  const validNames = new Set(base.validAnswers.map((p) => p.name));
  const decoyNames = new Set([correctPlayer.name]);
  const decoys = [];
  let attempts = 0;

  // Yanlış seçenekleri, tur havuzundan seçiyoruz — ve KESİNLİKLE fotoğrafları
  // olmak zorunda. Fotoğrafsız bir seçenek hemen göze batar ("kesin bu değil" der).
  while (decoys.length < 3 && attempts < 400) {
    attempts++;
    const candidate = pickWeighted(pool);
    if (!PLAYER_PHOTO_FILENAME[candidate.name]) continue; // Fotoğrafı yoksa pas geç
    if (validNames.has(candidate.name) || decoyNames.has(candidate.name)) continue;
    decoys.push(candidate);
    decoyNames.add(candidate.name);
  }

  // 31 Ağustos 2026 (Kerem: "1. seviye zorlukta hala çok enteresan/obskür
  // futbolcular çıkıyor") — KÖK NEDEN: havuzda (pool, zaten zorluk/popülerlik
  // filtresinden geçmiş) yeterince farklı fotoğraflı isim kalmayınca, bu
  // fallback döngü TÜM VERİ SETİNDEN (dataset — 43 bin oyuncu, HİÇ popülerlik
  // filtresi olmadan) rastgele seçiyordu. Zorluk 1'de havuz sadece birkaç
  // düzine küratörlü yıldızla sınırlı olduğundan bu fallback neredeyse HER
  // TURDA devreye giriyor ve ekranda tamamen alakasız/obskür oyuncular seçenek
  // olarak beliriyordu. ÇÖZÜM: fallback da AYNI (zorluk filtresinden geçmiş)
  // havuzdan seçmeli, ham dataset'ten değil.
  const poolPlayers = pool.entries.map((e) => e.player);
  while (decoys.length < 3 && attempts < 800 && poolPlayers.length > 0) {
    attempts++;
    const candidate = poolPlayers[Math.floor(Math.random() * poolPlayers.length)];
    if (!PLAYER_PHOTO_FILENAME[candidate.name]) continue; // Fotoğrafı yoksa pas geç
    if (validNames.has(candidate.name) || decoyNames.has(candidate.name)) continue;
    decoys.push(candidate);
    decoyNames.add(candidate.name);
  }

  if (decoys.length < 3) return null; // Gerçekten imkansızsa (havuz zorluk filtresiyle çok daralmışsa), bu turu atla

  const options = [...decoys, correctPlayer].sort(() => Math.random() - 0.5);
  return { teamA: base.teamA, teamB: base.teamB, key: base.key, correctPlayer, options };
}

// ============================================================================
// Ülke-Takım modu: "Bu ülkeden VE bu kulüpte oynamış futbolcuyu bil".
// Klasik kulüp+kulüp yerine ülke+kulüp eşleştirmesi.
//
// 31 Ağustos 2026 (Kerem): bu mod milli takım CAPS'ine (PLAYER_NATIONAL_TEAMS)
// değil, oyuncunun GERÇEK UYRUĞUNA (PLAYER_NATIONALITY) bakmalı — "Sacha Boey
// hiç Fransa A milli takımında oynamamış olsa bile Fransız'dır, İsmail Çipe
// Türk'tür" örneğiyle istendi. scripts/backfill_nationality.js çalıştırılana
// kadar PLAYER_NATIONALITY boş olabilir; o yüzden countriesForPlayer() eksik
// olduğunda PLAYER_NATIONAL_TEAMS'e (eski davranış) geri düşer — script
// çalışınca otomatik olarak gerçek uyruğa geçilmiş olur, kod değişmeden.
function countriesForPlayer(name) {
  const nationality = PLAYER_NATIONALITY[name];
  if (nationality && nationality.length > 0) return nationality;
  return PLAYER_NATIONAL_TEAMS[name] || [];
}

// Sadece bir uyruğu BİLİNEN oyunculardan bir havuz — aksi halde çoğu deneme
// (uyruğu olmayan oyuncuya rastlarsa) boşa gider.
export function computeCountryTeamPool(dataset, allowedClubsOrProfil, difficulty = 5) {
  const profil = profilMi(allowedClubsOrProfil) ? allowedClubsOrProfil : null;
  const allowedClubs = kapsamOf(allowedClubsOrProfil);
  let filtered = dataset.filter((p) => {
    const countries = countriesForPlayer(p.name);
    if (!countries || countries.length === 0) return false;
    const clubs = allowedClubs ? p.clubs.filter((c) => allowedClubs.has(c)) : p.clubs;
    return clubs.length > 0;
  });

  filtered = applyPopularityFloor(filtered, difficulty);
  // Ülke-kulüp modunda oyuncunun TEK uygun kulübü yeterli; profil çarpanı
  // en iyi kulübüne ve dönemine göre (oyuncuCarpani iki kulüp ister, burada değil).
  if (!profil) return havuzKur(filtered, null);
  const tekKulup = {
    ...profil,
    oyuncuCarpani: (p) => {
      let en = 0;
      for (const c of p.clubs) en = Math.max(en, profil.kulupCarpani(c));
      const iki = profil.oyuncuCarpani(p);
      return iki > 0 ? iki : en * 0.8;
    },
  };
  return havuzKur(filtered, tekKulup);
}

export function playersForCountryClub(dataset, country, club) {
  return dataset.filter((p) => {
    const countries = countriesForPlayer(p.name);
    return countries.includes(country) && p.clubs.includes(club);
  });
}

// --- Takım-Ülke "sen seç" modu: OYUNCU sadece TEK tarafı seçer (ülke YA DA
// kulüp), diğer tarafı rakip (CPU) seçer — tıpkı Takım-Takım/draft modunda
// oyuncunun teamA'yı seçip CPU'nun teamB'yi seçmesi gibi. Hangi tarafı kimin
// seçtiği her turda değişir (bkz. CountryTeamCpuScreen'deki manualTurn).
// Oyuncu ülkeyi seçtiğinde, CPU için uygun bir kulüp bulur:
export function generateCountryTeamRoundFromCountry(country, dataset, usedPairs, allowedClubs, difficulty = 5) {
  let players = dataset.filter((p) => countriesForPlayer(p.name).includes(country));
  if (allowedClubs) {
    players = players.filter((p) => p.clubs.some((c) => allowedClubs.has(c)));
  }
  if (players.length === 0) return null;

  const clubCounts = {};
  players.forEach((p) => {
    p.clubs.forEach((c) => {
      if (!allowedClubs || allowedClubs.has(c)) {
        clubCounts[c] = (clubCounts[c] || 0) + 1;
      }
    });
  });

  const candidates = Object.keys(clubCounts)
    .map((club) => ({ club, count: clubCounts[club] }))
    .filter((c) => !usedPairs.has(`${country}|${c.club}`));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (difficulty <= 4) return b.count - a.count;
    if (difficulty >= 8) return a.count - b.count;
    return Math.random() - 0.5;
  });
  const topN = candidates.slice(0, Math.min(10, candidates.length));
  const club = topN[Math.floor(Math.random() * topN.length)].club;
  const key = `${country}|${club}`;
  const validAnswers = playersForCountryClub(dataset, country, club);
  if (validAnswers.length === 0) return null;
  return { country, club, validAnswers, key };
}

// Oyuncu kulübü seçtiğinde, CPU için uygun bir ülke bulur:
export function generateCountryTeamRoundFromClub(club, dataset, usedPairs, allowedClubs, difficulty = 5) {
  const players = dataset.filter((p) => p.clubs.includes(club));
  if (players.length === 0) return null;

  const countryCounts = {};
  players.forEach((p) => {
    countriesForPlayer(p.name).forEach((country) => {
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
  });

  const candidates = Object.keys(countryCounts)
    .map((country) => ({ country, count: countryCounts[country] }))
    .filter((c) => !usedPairs.has(`${c.country}|${club}`));
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (difficulty <= 4) return b.count - a.count;
    if (difficulty >= 8) return a.count - b.count;
    return Math.random() - 0.5;
  });
  const topN = candidates.slice(0, Math.min(10, candidates.length));
  const country = topN[Math.floor(Math.random() * topN.length)].country;
  const key = `${country}|${club}`;
  const validAnswers = playersForCountryClub(dataset, country, club);
  if (validAnswers.length === 0) return null;
  return { country, club, validAnswers, key };
}

// --- Takım-Ülke "sen seç" modu için: kullanıcı ülke adını (Türkçe alias'lar
// dahil, ör. "Türkiye" -> "Turkey") yazınca doğru kanonik isme eşleştirir.
// countriesMap: lib/countries.json — { "Turkey": { aliases: ["Türkiye"] }, ... }
// 11 Eylül 2026 (Kerem: "yazarken ülkeler de takımlar da futbolcular da
// POPÜLARİTESİNE göre tavsiye edilmeli" + "ülke isimleri Türkçe olmalı") —
// indeks artık (a) Türkçe adları da tanıyor, (b) her ülkeye veri setindeki
// oyuncu sayısını "popülerlik" olarak yazıyor. `dataset` verilmezse eski
// davranış (alfabetik) sürüyor, hiçbir çağrı kırılmıyor.
export function buildCountrySuggestIndex(countriesMap, dataset) {
  const populerlik = {};
  if (dataset) {
    for (const p of dataset) {
      for (const ulke of countriesForPlayer(p.name)) {
        populerlik[ulke] = (populerlik[ulke] || 0) + 1;
      }
    }
  }
  const index = [];
  Object.keys(countriesMap).forEach((canonical) => {
    const pop = populerlik[canonical] || 0;
    const tr = COUNTRY_TR[canonical];
    index.push({ original: canonical, canonical, normalized: normalize(canonical), pop });
    if (tr && tr !== canonical) {
      index.push({ original: tr, canonical, normalized: normalize(tr), pop });
    }
    (countriesMap[canonical].aliases || []).forEach((alias) => {
      index.push({ original: alias, canonical, normalized: normalize(alias), pop });
    });
  });
  // Çok futbolcusu olan ülkeler önce önerilsin (Brezilya, Fransa, Türkiye...).
  index.sort((a, b) => (b.pop || 0) - (a.pop || 0));
  return index;
}

export function suggestCountries(index, input, limit = 5) {
  const n = normalize(input);
  if (!n) return [];
  const seen = new Set();
  const results = [];
  for (const item of index) {
    if (results.length >= limit) break;
    if (seen.has(item.canonical)) continue;
    if (item.normalized.startsWith(n) || item.normalized.includes(n)) {
      // Ekranda Türkçe ad, arka planda İngilizce kanonik ad.
      results.push({ display: countryTr(item.canonical), canonical: item.canonical });
      seen.add(item.canonical);
    }
  }
  return results;
}

export function findMatchedCountry(input, countriesMap) {
  const n = normalize(input);
  if (!n) return null;
  let bestMatch = null;
  let bestDist = 999;
  for (const canonical of Object.keys(countriesMap)) {
    // Kullanıcı "Hollanda" yazdığında da "Netherlands" bulunsun diye
    // Türkçe ad da aday listesine ekleniyor.
    const candidates = [canonical, COUNTRY_TR[canonical], ...((countriesMap[canonical] || {}).aliases || [])]
      .filter(Boolean);
    for (const c of candidates) {
      const full = normalize(c);
      if (n === full) return canonical;
      if (full.startsWith(n) && n.length >= 3) return canonical;
      const dist = levenshtein(n, full);
      if (dist <= Math.floor(n.length / 4) + 1 && dist < bestDist) {
        bestDist = dist;
        bestMatch = canonical;
      }
    }
  }
  return bestMatch;
}

export function generateCountryTeamRound(pool, dataset, usedPairs, allowedClubsOrProfil) {
  if (pool.entries.length === 0) return null;
  const profil = pool.profil || (profilMi(allowedClubsOrProfil) ? allowedClubsOrProfil : null);
  const allowedClubs = profil ? profil.kapsam : kapsamOf(allowedClubsOrProfil);
  for (let attempt = 0; attempt < 200; attempt++) {
    const player = pickWeighted(pool);
    const teams = countriesForPlayer(player.name);
    if (teams.length === 0) continue;
    const clubs = (allowedClubs ? player.clubs.filter((c) => allowedClubs.has(c)) : player.clubs).filter((c) => !rezervTakimMi(c));
    if (clubs.length === 0) continue;
    const country = teams[Math.floor(Math.random() * teams.length)];
    const club = clubs.length >= 2 && profil ? ciftSec(clubs, profil)[0] : clubs[Math.floor(Math.random() * clubs.length)];
    const key = `${country}|${club}`;
    if (usedPairs.has(key)) continue;
    const validAnswers = playersForCountryClub(dataset, country, club);
    if (validAnswers.length === 0) continue;
    return { country, club, validAnswers, key };
  }
  return null;
}

// ============================================================================
// "Who am I?" modu: bir oyuncu seçilir, ipuçları (milliyet, kulüp sayısı,
// en az/en çok bilinen kulübü, fotoğraf) tek tek açılır. Her açılan ipucu
// puanı azaltır.
// ============================================================================
export function generateWhoAmIRound(pool, usedNames) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const player = pickWeighted(pool);
    if (usedNames.has(player.name)) continue;
    if (player.clubs.length < 2) continue; // en az 2 kulüp olsun, ipuçları anlamlı olsun
    return player;
  }
  return null;
}

// Bir oyuncu için ipucu havuzunu üretir — en fazla 10 ipucu, EN BELİRSİZDEN
// EN NETE doğru kademeli (her kademe içinde rastgele sırayla, tekrar
// oynanabilirlik için). Sadece VERİSİ olan ipuçları listeye girer.
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}


function generateDynamicHint(player, info, teams) {
  const clubs = player.clubs;
  if (clubs.length < 2) return null;
  
  const firstClub = clubs[clubs.length - 1]; // json'da genelde eskiden yeniye doğru mu yoksa yeniden eskiye mi?
  // Bizim json'da genelde eskiden yeniye. Yani son eleman en son oynadığı takım.
  // Kontrol edelim. Eğer "Arda Turan" ise son takım "Galatasaray" (2020-2022). İlk takım "Galatasaray" (2005-2011).
  const startClub = clubs[0];
  const endClub = clubs[clubs.length - 1];
  
  // Araya birkaç popüler kulüp seç
  const allOther = clubs.slice(1, -1);
  const famous = allOther.filter(c => ["Galatasaray", "Real Madrid", "Barcelona", "Fenerbahçe", "Beşiktaş", "Chelsea", "Manchester United", "Bayern Munich", "Juventus", "Inter", "AC Milan", "Liverpool", "Arsenal", "Atletico Madrid", "Paris Saint-Germain"].includes(c));
  
  let text = `Profesyonel kariyerine ${startClub} formasıyla adım atan bu isim, `;
  
  if (famous.length > 0) {
    // Aynı kulübü tekrar yazmamak için set
    const uniqueFamous = [...new Set(famous)];
    text += `özellikle ${uniqueFamous.slice(0, 2).join(' ve ')} gibi dev kulüplerde gösterdiği performansla hafızalara kazındı. `;
  } else if (allOther.length > 0) {
    text += `kariyeri boyunca ${[...new Set(allOther)].slice(0, 2).join(', ')} gibi ekiplerde de ter döktü. `;
  }
  
  if (endClub !== startClub) {
    text += `Kariyerinin son/güncel dönemlerinde ise ${endClub} forması giydi.`;
  }
  
  if (info && info.position && teams && teams.length > 0) {
    const uyrukTr = countryTr(teams[0]) || teams[0];
    const mevkiTr = (positionTr(info.position) || info.position).toLocaleLowerCase("tr-TR");
    text += ` Kendisi ${uyrukTr} asıllı ünlü bir ${mevkiTr} oyuncusudur.`;
  }
  
  return text;
}

export function buildWhoAmIClues(player) {
  const info = PLAYER_BIRTH_POSITION[player.name] || {};
  const teams = PLAYER_NATIONAL_TEAMS[player.name];
  const lastYear = PLAYER_LAST_ACTIVE_YEAR[player.name];
  const achievements = PLAYER_ACHIEVEMENTS[player.name];
  const hint = PLAYER_HINTS[player.name];

  // Kademe 1 — en belirsiz
  const tier1 = [];
  if (teams && teams.length > 0) {
    // 12 Eylül 2026 (Kerem: "Kim Bu Futbolcu modunda etiketler İngilizce") —
    // ipucu metinleri ham veri setinden geliyordu ("France", "Attacking
    // midfielder"). Çeviri katmanı zaten vardı, burada kullanılmıyordu.
    tier1.push({ type: "nationality", label: "Milliyet", text: teams.map((t) => countryTr(t) || t).join(", ") });
  }
  if (lastYear) {
    const decade = Math.floor(lastYear / 10) * 10;
    tier1.push({ type: "era", label: "Kariyer Dönemi", text: `Kariyeri ${decade}'lar civarında` });
  }

  // Kademe 2 — orta
  const tier2 = [];
  if (info.position) tier2.push({ type: "position", label: "Mevki", text: positionTr(info.position) || info.position });
  if (info.birthYear) {
    const age = new Date().getFullYear() - info.birthYear;
    tier2.push({ type: "age", label: "Doğum Yılı", text: `${info.birthYear} doğumlu (~${age} yaşında)` });
  }
  tier2.push({ type: "clubCount", label: "Kaç Farklı Kulüp", text: `${player.clubs.length} farklı kulüpte oynadı` });

  // Başarılar da Kademe 2 ve 3 arasına serpiştirilsin
  if (achievements && achievements.length > 0) {
    const shuffleAwards = [...achievements].sort(() => Math.random() - 0.5).slice(0, 2);
    shuffleAwards.forEach((award, idx) => {
      tier2.push({ type: `award${idx}`, label: "Kariyer Başarısı", text: award });
    });
  }

  // Kademe 3 — daha net: kulüpler
  const tier3 = [];
  const sortedByWeight = [...player.clubs].sort((a, b) => weightForClubs([a]) - weightForClubs([b]));
  const clubClueCount = Math.min(3, sortedByWeight.length);
  const usedIdx = new Set();
  for (let i = 0; i < clubClueCount; i++) {
    const idx = Math.floor((i / Math.max(1, clubClueCount - 1)) * (sortedByWeight.length - 1));
    if (usedIdx.has(idx)) continue;
    usedIdx.add(idx);
    tier3.push({ type: `club${i}`, label: "Oynadığı Kulüplerden Biri", text: sortedByWeight[idx] });
  }

  // Kademe 4 — en net
  const tier4 = [
    { type: "initial", label: "Adının İlk Harfi", text: `${player.name[0].toLocaleUpperCase("tr-TR")}...` },
    { type: "photo", label: "Fotoğrafı", text: null },
  ];

  // 12 Eylül 2026 — ESKİ HALİ BOZUKTU: dört kademe birleştirilip `slice(0, 10)`
  // uygulanıyordu. Kademe 1-3 zaten 10 ipucuyu doldurabildiği için (çok kulüplü,
  // çok başarılı oyuncularda sık sık oluyordu) EN NET iki ipucu — ilk harf ve
  // fotoğraf — listeden tamamen düşüyordu. Online modda bu, turun hiç
  // bilinemeden kapanması demek. Artık son kademe garanti: önce 1-3'ü 8'e
  // kırpıyoruz, kesinleştirici ipuçlarını sonra ekliyoruz.
  const belirsizler = [...shuffle(tier1), ...shuffle(tier2), ...shuffle(tier3)].slice(0, 8);
  return [...belirsizler, ...tier4];
}

// ============================================================================
// "5 Kulüp" modu — 4 Eylül 2026 (Kerem'in yeni mod isteği).
// Kural: Ekranda 5 (büyükçe, tanıdık) kulüp gösterilir. Oyuncu bir futbolcu
// söyler; o futbolcu bu 5 kulübün KAÇINDA oynamışsa o kadar PUAN kazanır
// (hepsinde oynamış olması gerekmiyor — ama GEÇERLİ bir cevap sayılması için
// EN AZ 2 kulüpte oynamış olması şart, yoksa "yanlış" muamelesi görür ve sıra
// rakibe geçer — tek kulüplü bir isim vermek çok kolay olurdu, bu eşik oyunu
// anlamlı kılıyor). 3 tur oynanır, her turda kulüpler DEĞİŞİR, 3 tur
// sonundaki toplam puan kazananı belirler.
// ============================================================================
import { MEGA, BIG, CHAMPIONS_LEAGUE_CLUBS, WELL_KNOWN_EXTRA } from "./clubWeights";

// Bu havuzdaki kulüpler kasıtlı olarak "büyükçe/tanıdık" — rastgele bir alt
// lig takımıyla eşleşmiyor, aksi halde 5 kulübün 2'sinde birden oynamış birini
// bulmak neredeyse imkansız olurdu. MEGA + BIG + Şampiyonlar Ligi klasikleri +
// (4 Eylül 2026, 12. tur: "havuzu arttıralım") WELL_KNOWN_EXTRA — gerçek
// bağlantı analizine göre seçilmiş, aynı derecede tanıdık ek kulüpler.
export const FIVE_CLUB_POOL = [...new Set([...MEGA, ...BIG, ...CHAMPIONS_LEAGUE_CLUBS, ...WELL_KNOWN_EXTRA])];

// 4 Eylül 2026 (14. tur, Kerem: "3 kademe zorluk olsun, normal-zor-çok zor" +
// setup ekranından seçilebilecek bir zorluk butonu istedi) — her kademe daha
// GENİŞ (ve dolayısıyla daha az tanıdık) bir kulüp evrenine izin veriyor.
// "Normal" SADECE en akla ilk gelen (MEGA+BIG) kulüplerle sınırlı, "Çok Zor"
// tüm 54 kulüplük havuzu (WELL_KNOWN_EXTRA dahil) açıyor.
// 4 Ekim 2026 (Kerem: "neredeyse hep aynı takımlar çıkıyor") — KÖK NEDEN:
// Normal'de havuz yalnızca 19 kulüptü (MEGA + BIG) ve çıpa hep 10 MEGA
// kulübünden geliyordu; üstüne eşleşme profilinin eğilimi (Türkiye ağırlıklı
// profilde TR kulübü ×5 → sıralamada +0,8 kayma) rastgeleliği eziyordu, yani
// GS/FB/BJK/TS neredeyse her turda vardı. ÇÖZÜM: havuzlar genişledi (37 / 53 /
// 88 kulüp), profil eğilimi hafifledi, bir turda en fazla 2 Türk kulübü var ve
// son 2 turda çıkan kulüpler tekrar gelmiyor (bkz. generateFiveClubRound).
const FIVE_EK_NORMAL = ["Roma", "Lazio", "Tottenham Hotspur", "Marseille", "Valencia", "Bayer Leverkusen", "Schalke 04", "Lyon", "Sporting CP", "Monaco"];
const FIVE_EK_COKZOR = [
  "VfL Wolfsburg", "VfB Stuttgart", "Eintracht Frankfurt", "Werder Bremen", "Hamburger SV", "Borussia Mönchengladbach",
  "Lille", "Nice", "Bordeaux", "Sampdoria", "Udinese", "Torino", "Parma", "Bologna", "Genoa", "Southampton",
  "Crystal Palace", "Fulham", "Leeds United", "Sunderland", "Espanyol", "Betis", "Deportivo La Coruña",
  "Olympiacos", "Anderlecht", "Club Brugge", "Rangers", "Bursaspor", "Başakşehir", "Kasımpaşa", "Sivasspor",
  "Antalyaspor", "Kayserispor", "Göztepe", "Konyaspor",
];
const FIVE_TR_KULUPLERI = new Set(["Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "Bursaspor", "Başakşehir", "Kasımpaşa", "Sivasspor", "Antalyaspor", "Kayserispor", "Göztepe", "Konyaspor"]);
export const FIVE_CLUB_MAX_TR = 2;
export const FIVE_CLUB_DIFFICULTIES = {
  normal: { label: "Normal", pool: [...new Set([...MEGA, ...BIG, ...CHAMPIONS_LEAGUE_CLUBS, ...FIVE_EK_NORMAL])] },
  zor: { label: "Zor", pool: [...new Set([...MEGA, ...BIG, ...CHAMPIONS_LEAGUE_CLUBS, ...FIVE_EK_NORMAL, ...WELL_KNOWN_EXTRA])] },
  cokZor: { label: "Çok Zor", pool: [...new Set([...FIVE_CLUB_POOL, ...FIVE_EK_NORMAL, ...FIVE_EK_COKZOR])] },
};
export const FIVE_CLUB_DEFAULT_DIFFICULTY = "normal";

export const FIVE_CLUB_TIME_OPTIONS = [20, 30, 45, 60];
export const FIVE_CLUB_MIN_OVERLAP = 2; // geçerli bir cevap için gereken asgari ortak kulüp sayısı
export const FIVE_CLUB_TOTAL_ROUNDS = 3;

// Bir turun "çözülebilir" olduğunu (en az birkaç geçerli aday olduğunu)
// garanti etmek için hızlı bir sayım yapıyoruz — tamamen şansa bırakılırsa
// bazen 5 kulübün ikisinde bile kimse oynamamış olabilir (nadir ama olası).
function countFiveClubCandidates(dataset, fiveClubs, stopAt) {
  const clubSet = new Set(fiveClubs.map(canonicalClub));
  let count = 0;
  for (const p of dataset) {
    let overlap = 0;
    for (const c of canonicalClubSet(p.clubs)) {
      if (clubSet.has(c)) overlap++;
    }
    if (overlap >= FIVE_CLUB_MIN_OVERLAP) {
      count++;
      if (count >= stopAt) return count;
    }
  }
  return count;
}

// 4 Eylül 2026 (14. tur, Kerem: "her el en az 1 baba takım sorulmalı, en en
// büyükler + GS ya da FB diye düşünebilirsin havuzu") — `guaranteedPool`
// (varsayılan: MEGA) içinden HER ZAMAN en az 1 kulüp seçilip 5'liğe dahil
// ediliyor, geri kalan 4'ü normal `clubPool`'dan (zorluk seviyesine göre
// değişir) geliyor — böylece hangi zorlukta olursa olsun oyuncuların
// tanıyacağı en az bir "çıpa" kulüp her turda garanti.
export function generateFiveClubRound(dataset, clubPool, usedClubKeys, guaranteedPool = MEGA, profil = null, sonKulupler = []) {
  // 28 Eylül 2026 — Eşleşme Profili: profilin dışarıda bıraktığı kulüpler
  // havuzdan çıkar (havuz 8'in altına düşmezse), kalanlar profil ağırlığına
  // göre öne çekilir.
  if (profilMi(profil)) {
    const suzulmus = clubPool.filter((c) => profil.kulupCarpani(c) > 0);
    if (suzulmus.length >= 8) clubPool = suzulmus;
    const cap = guaranteedPool.filter((c) => profil.kulupCarpani(c) > 0);
    if (cap.length) guaranteedPool = cap;
  } else profil = null;
  // guaranteedPool, clubPool'un İÇİNDE değilse (örn. ileride farklı bir
  // zorluk/çıpa kombinasyonu denenirse) yine de çalışsın diye birleştiriyoruz.
  const guaranteedInPool = guaranteedPool.filter((c) => clubPool.includes(c));
  let anchorSource = guaranteedInPool.length > 0 ? guaranteedInPool : guaranteedPool;
  let restPool = clubPool.filter((c) => !anchorSource.includes(c));
  // Son 2 turda çıkan kulüpler bu tur gelmesin (havuz yeterince büyükse).
  const yakin = new Set(sonKulupler.map(canonicalClub));
  const tazeCapa = anchorSource.filter((c) => !yakin.has(canonicalClub(c)));
  if (tazeCapa.length >= 2) anchorSource = tazeCapa;
  const tazeKalan = restPool.filter((c) => !yakin.has(canonicalClub(c)));
  if (tazeKalan.length >= 8) restPool = tazeKalan;
  // Profil eğilimi artık hafif (en fazla ±0,25): tercih eder ama rastgeleliği ezmez.
  const egilim = (c) => (profil ? Math.max(-0.25, Math.min(0.25, 0.12 * Math.log2(Math.max(0.05, profil.kulupCarpani(c))))) : 0);

  for (let attempt = 0; attempt < 80; attempt++) {
    const anchor = anchorSource[Math.floor(Math.random() * anchorSource.length)];
    const shuffledRest = [...restPool]
      .map((c) => ({ c, k: Math.random() - egilim(c) }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.c);
    // En fazla 2 Türk kulübü (çıpa dahil).
    let trSayisi = FIVE_TR_KULUPLERI.has(anchor) ? 1 : 0;
    const secilen = [];
    for (const c of shuffledRest) {
      if (secilen.length >= 4) break;
      if (FIVE_TR_KULUPLERI.has(c)) {
        if (trSayisi >= FIVE_CLUB_MAX_TR) continue;
        trSayisi++;
      }
      secilen.push(c);
    }
    const clubs = [anchor, ...secilen];
    if (clubs.length < 5) continue; // havuz çok küçükse (pratikte olmaz) atla
    const key = [...clubs].sort().join("|");
    if (usedClubKeys.has(key)) continue;
    if (countFiveClubCandidates(dataset, clubs, 3) >= 3) {
      return { clubs, key };
    }
  }
  return null; // 80 denemede bile çözülebilir bir set bulunamadıysa (havuz çok küçükse) pes et
}

// Bir oyuncunun bu 5 kulübün kaçında oynadığını (ve HANGİLERİNDE) döndürür.
// 4 Eylül 2026 (Kerem: "burada Caner Erkin'i nasıl bilemedi?") — Caner Erkin
// veri setinde "Inter Milan" olarak kayıtlı ama tur ekranında "Internazionale"
// yazıyordu; ikisi AYNI kulüp olduğu hâlde düz metin karşılaştırması
// eşleştirmiyor, oyuncu hak ettiği puanı ALAMIYORDU. Artık karşılaştırma
// kanonik ada göre yapılıyor (bkz. lib/clubAliases.js).
// NOT: dönen `matchedClubs`, oyuncunun kayıtlı yazımını değil TURDA GÖSTERİLEN
// kulüp adlarını içeriyor — böylece sonuç ekranında ekrandaki rozetlerle
// birebir aynı isimler görünüyor.
export function scoreFiveClubAnswer(player, fiveClubs) {
  const playerSet = canonicalClubSet(player.clubs);
  const matchedClubs = fiveClubs.filter((c) => playerSet.has(canonicalClub(c)));
  return { count: matchedClubs.length, matchedClubs };
}

// Bu turun (kulüp setinin) en iyi olası cevaplarını gösterme ekranı için —
// "kimse bilemedi" durumunda ipucu/doğru cevap paneli.
// 4 Ekim 2026 — tur sonu "en iyi cevap": en çok kulübe uyan, aralarından en tanınmış.
export function enIyiFiveClubCevabi(dataset, fiveClubs, taninirlikFn = playerWeight) {
  let en = null;
  for (const p of dataset) {
    const s = scoreFiveClubAnswer(p, fiveClubs);
    if (s.count < FIVE_CLUB_MIN_OVERLAP) continue;
    if (!en || s.count > en.count || (s.count === en.count && taninirlikFn(p) > taninirlikFn(en.player))) {
      en = { player: p, ...s };
    }
  }
  return en;
}

export function bestFiveClubAnswers(dataset, fiveClubs, limit = 8) {
  const scored = dataset
    .map((p) => ({ player: p, ...scoreFiveClubAnswer(p, fiveClubs) }))
    .filter((s) => s.count >= FIVE_CLUB_MIN_OVERLAP)
    .sort((a, b) => b.count - a.count || playerWeight(b.player) - playerWeight(a.player));
  return scored.slice(0, limit);
}

// 4 Eylül 2026 (Kerem: "doğru cevaplar 5 Takım-4 Takım-3 Takım-2 Takım diye
// kategorize edilmeli") — bestFiveClubAnswers'ın düz listesini kaç kulüpte
// oynadıklarına göre AYRI KOVALARA ayırır (5'ten 2'ye, FIVE_CLUB_MIN_OVERLAP
// ile aynı taban). Her kovada en fazla `perBucket` isim, ünlülüğe göre sıralı.
export function bestFiveClubAnswersGrouped(dataset, fiveClubs, perBucket = 5) {
  const scored = dataset
    .map((p) => ({ player: p, ...scoreFiveClubAnswer(p, fiveClubs) }))
    .filter((s) => s.count >= FIVE_CLUB_MIN_OVERLAP);
  const buckets = {};
  for (let n = 5; n >= FIVE_CLUB_MIN_OVERLAP; n--) {
    buckets[n] = scored
      .filter((s) => s.count === n)
      .sort((a, b) => playerWeight(b.player) - playerWeight(a.player))
      .slice(0, perBucket);
  }
  return buckets; // { 5: [...], 4: [...], 3: [...], 2: [...] }
}
