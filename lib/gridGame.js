// ============================================================================
// FUTBOLCU XOX (3x3 IZGARA) — 12 Eylül 2026, Kerem'in isteği
//   "xox oyunu da eklemek istiyorum. hem vs cpu hem aynı ekranda arkadaşla
//    oynama şekli."
//
// Düz tic-tac-toe yerine futbol bilgisiyle oynanan XOX: ızgaranın 3 SATIRINDA
// ve 3 SÜTUNUNDA birer kulüp var. Bir kareyi almak için o karenin satır ve
// sütun kulüplerinin İKİSİNDE DE oynamış bir futbolcu söylemek gerekiyor.
// Bilirsen kare senin olur, bilemezsen sıra rakibe geçer. Üçlü sırayı yapan
// kazanır; tahta çizgisiz dolarsa berabere (Paket 42; uzatma ayarı var).
//
// Kurallar burada SAF fonksiyonlar olarak duruyor: React yok, Supabase yok.
// Hem CPU hem "aynı telefonda 2 kişi" modu bu tek dosyayı kullanıyor, yani
// kural farkı olması imkansız.
// ============================================================================
import { _t } from "./dil";
import { playersForPair, findMatchedPlayer, rezervTakimMi, FIVE_CLUB_POOL } from "./gameEngine";
import { canonicalClub, canonicalClubSet } from "./clubAliases";
import { PLAYER_NATIONALITY } from "./playerNationality";
import { PLAYER_NATIONAL_TEAMS } from "./playerNationalTeams";
import { countryTr } from "./countryNamesTr";
import { flagForCountry } from "./countryFlags";
import { recognitionScore, MEGA, BIG, CHAMPIONS_LEAGUE_CLUBS, WELL_KNOWN_EXTRA } from "./clubWeights";
import { BASARILAR, oduller, basariVerisiVarMi } from "./basarilar";
import { cpuBilirMi, taninirlik } from "./taninirlik";

export const ASGARI_HUCRE_CEVAP = 3;   // mutlak taban (en zor seviye)
export const X = "x";
export const O = "o";

// Izgarada SADECE tanıdık kulüpler kullanılıyor. "Jong Ajax x Real Madrid C"
// gibi bir ızgara teknik olarak geçerli ama oynanamaz olurdu.
function temizle(liste) {
  const gorulen = new Set();
  const sonuc = [];
  for (const ham of liste) {
    const c = canonicalClub(ham) || ham;
    if (rezervTakimMi(c) || gorulen.has(c)) continue;   // "Inter Milan"/"Internazionale" tek kayda düşsün
    gorulen.add(c);
    sonuc.push(c);
  }
  return sonuc;
}

const TANIDIK = temizle(FIVE_CLUB_POOL);

// ============================================================================
// KARMA IZGARA — KOŞULLAR (27 Eylül 2026)
// Kerem: "xox'te başarı/takım, ülke/takım, karma modları vb gelecek. örneğin
// real'de oynamış ballon dor sahipleri gibi bir sütun da olacak."
//
// Izgara başlıkları artık sadece kulüp değil, bir KOŞUL olabilir. Kulüpler
// eskisi gibi düz metin ("Galatasaray"); diğerleri önekli metin:
//   "ulke:Brazil"        -> Brezilyalı
//   "basari:ballonDor"   -> Ballon d'Or sahibi
// Başlık hâlâ metin olduğu için oyun durumu, kayıt, test ve ekran kodu
// değişmeden çalışıyor; sadece "bu oyuncu bu başlığa uyuyor mu" ve "başlık
// nasıl görünür" soruları buradaki fonksiyonlardan geçiyor.
// ============================================================================
export const IZGARA_TURLERI = [
  { deger: "kulup", etiket: _t("Sadece kulüpler") },
  { deger: "ulke", etiket: _t("Kulüp + Ülke") },
  { deger: "basari", etiket: _t("Kulüp + Başarı") },
  { deger: "karma", etiket: _t("Karma") },
];

// Izgarada kullanılabilecek ülkeler (veri setinde yeterince oyuncusu olanlar).
const ULKE_HAVUZU = [
  "Turkey", "Brazil", "Argentina", "France", "Spain", "Germany", "Italy", "England",
  "Netherlands", "Portugal", "Belgium", "Uruguay", "Croatia", "Serbia", "Nigeria",
  "Senegal", "Ivory Coast", "Cameroon", "Morocco", "Colombia", "Denmark", "Sweden",
  "Switzerland", "Poland", "Scotland", "Ghana", "Algeria", "Austria", "Greece", "Czech Republic",
];

// Başarı listesi lib/basarilar.js'te (mini profil de kullanıyor).
export { BASARILAR, basariVerisiVarMi };

export function kosulTuru(h) {
  if (typeof h !== "string") return "kulup";
  if (h.startsWith("ulke:")) return "ulke";
  if (h.startsWith("basari:")) return "basari";
  return "kulup";
}
export function kosulEtiketi(h) {
  const t = kosulTuru(h);
  if (t === "ulke") return countryTr(h.slice(5)) || h.slice(5);
  if (t === "basari") return (BASARILAR[h.slice(7)] || {}).etiket || h.slice(7);
  return h;
}
export function kosulBayragi(h) {
  return kosulTuru(h) === "ulke" ? flagForCountry(h.slice(5)) : null;
}
export function kosulIkonu(h) {
  return kosulTuru(h) === "basari" ? (BASARILAR[h.slice(7)] || {}).ikon || "trophy" : null;
}

function ulkeleri(ad) {
  const n = PLAYER_NATIONALITY[ad];
  if (n && n.length) return n;
  return PLAYER_NATIONAL_TEAMS[ad] || [];
}

export function kosulSaglar(p, h) {
  const t = kosulTuru(h);
  if (t === "ulke") return ulkeleri(p.name).includes(h.slice(5));
  if (t === "basari") return (oduller()[p.name] || []).includes(h.slice(7));
  return canonicalClubSet(p.clubs || []).has(canonicalClub(h));
}

// Koşul -> onu sağlayan oyuncu indeksleri (önbellekli). PERFORMANS: 46 bin
// oyuncuyu her koşul için ayrı ayrı taramak telefonda saniyeler sürüyordu;
// aynı türdeki bütün kümeler (bütün tanıdık kulüpler, bütün ülkeler, bütün
// başarılar) TEK geçişte kuruluyor.
const _kume = new Map();
let _kumeVeri = null;
const _kurulanTurler = new Set();
function turKumeleriniKur(veriSeti, tur) {
  const hedef = new Map();
  if (tur === "kulup") for (const c of TANIDIK) hedef.set(c, new Set());
  if (tur === "ulke") for (const u of ULKE_HAVUZU) hedef.set("ulke:" + u, new Set());
  if (tur === "basari") for (const b of Object.keys(BASARILAR)) hedef.set("basari:" + b, new Set());
  const od = tur === "basari" ? oduller() : null;
  for (let i = 0; i < veriSeti.length; i++) {
    const p = veriSeti[i];
    if (tur === "kulup") {
      for (const c of canonicalClubSet(p.clubs || [])) { const k = hedef.get(c); if (k) k.add(i); }
    } else if (tur === "ulke") {
      for (const u of ulkeleri(p.name)) { const k = hedef.get("ulke:" + u); if (k) k.add(i); }
    } else if (od) {
      for (const b of od[p.name] || []) { const k = hedef.get("basari:" + b); if (k) k.add(i); }
    }
  }
  for (const [h, k] of hedef) _kume.set(h, k);
  _kurulanTurler.add(tur);
}
function kosulKumesi(veriSeti, h) {
  if (_kumeVeri !== veriSeti) { _kume.clear(); _kurulanTurler.clear(); _kumeVeri = veriSeti; }
  let k = _kume.get(h);
  if (k) return k;
  const tur = kosulTuru(h);
  if (!_kurulanTurler.has(tur)) {
    turKumeleriniKur(veriSeti, tur);
    k = _kume.get(h);
    if (k) return k;
  }
  k = new Set();
  for (let i = 0; i < veriSeti.length; i++) if (kosulSaglar(veriSeti[i], h)) k.add(i);
  _kume.set(h, k);
  return k;
}
export function kosulKesisimSayisi(veriSeti, a, b) {
  const A = kosulKumesi(veriSeti, a), B = kosulKumesi(veriSeti, b);
  const [kucuk, buyuk] = A.size <= B.size ? [A, B] : [B, A];
  let n = 0;
  for (const i of kucuk) if (buyuk.has(i)) n++;
  return n;
}

function ekKosulHavuzu(tur) {
  const ulke = ULKE_HAVUZU.map((u) => "ulke:" + u);
  const basari = basariVerisiVarMi() ? Object.keys(BASARILAR).map((b) => "basari:" + b) : [];
  if (tur === "ulke") return ulke;
  if (tur === "basari") return basari.length ? basari : ulke;
  if (tur === "karma") return [...ulke, ...basari];
  return [];
}

// Kulübün "tanınırlık kademesi" — kolay seviyelerde ızgarayı ünlü kulüplere
// doğru çekmek için. ÖLÇÜMDEN ÇIKAN İHTİYAÇ: sadece "kesişim dolu olsun" diye
// seçince Çok Kolay ızgaralar baştan sona Serie A oluyordu (Atalanta ×
// Fiorentina × Lazio) — kesişimleri gerçekten dolu ama Türkiye'deki ortalama
// oyuncu için "kolay" değil. Ün puanı bunu dengeliyor.
const UN_PUANI = new Map();
for (const c of temizle(CHAMPIONS_LEAGUE_CLUBS)) UN_PUANI.set(c, 1);
for (const c of temizle(BIG)) UN_PUANI.set(c, 2);
for (const c of temizle(MEGA)) UN_PUANI.set(c, 3);
function unPuani(c) { return UN_PUANI.get(c) || 0; }

// --- ZORLUK SEVİYELERİ ------------------------------------------------------
// 13 Eylül 2026 (Kerem: "gelen takımlar zorluk derecesine göre daha kolay
// olmalı... 5 zorluk derecesi koy. şu an kolay modda bile bulması aşırı zor
// takımlar geliyor.")
//
// İLK SÜRÜMDEKİ HATA: zorluk SADECE CPU'yu ayarlıyordu — ızgara her seviyede
// aynı geniş havuzdan kuruluyordu. Yani "Kolay" seçmek soruyu kolaylaştırmıyor,
// sadece rakibi zayıflatıyordu; oyuncu hâlâ "Sporting CP + Feyenoord" gibi bir
// kareye bakıyordu. Zorluk artık İKİ ŞEYİ birden belirliyor:
//   havuz  : ızgarada hangi kulüplerin çıkabileceği (tanınırlık kademesi)
//   asgari : her kesişimde en az kaç ortak futbolcu olacağı (düşükse ezber ister)
// ÖLÇÜM NOTU: ilk denemede "kolay = sadece dev kulüpler" yaptım ve TERS TEPTİ.
// MEGA listesi 3 Türk + 7 Avrupa devi; "Beşiktaş × Bayern" gibi kareler zorunlu
// hale geliyor ve bunların ortak oyuncusu 5-6 kişi. Ölçtüm: sadece-MEGA ızgarada
// kare başına ortalama 14,7 cevap çıktı, MEGA+BIG havuzunda ise 23,2. Yani
// zorluğu belirleyen şey kulüplerin ÜNÜ değil, kesişimlerin DOLULUĞU.
// Bu yüzden ana kol `asgari` (ve en zor iki seviyede `azami`), havuz ikincil.
// Buna CPU'nun bilgi/taktik ayarları ekleniyor.
export const ZORLUKLAR = [
  { id: 1, etiket: _t("Çok Kolay"), aciklama: _t("Bol ortak isimli dev kulüpler"), kademe: 5, asgari: 35, azami: null, un: 0.55, bilgi: 0.35, taktik: 0.10, dilim: 50 },
  { id: 2, etiket: _t("Kolay"),     aciklama: _t("Tanıdık kulüpler, rahat kareler"), kademe: 5, asgari: 20, azami: null, un: 0.40, bilgi: 0.50, taktik: 0.30, dilim: 35 },
  { id: 3, etiket: _t("Orta"),      aciklama: _t("Dengeli"),                        kademe: 5, asgari: 10, azami: null, un: 0.20, bilgi: 0.68, taktik: 0.60, dilim: 20 },
  { id: 4, etiket: _t("Zor"),       aciklama: _t("Az ortak isimli kareler"),        kademe: 5, asgari: 4,  azami: 14,   un: 0.05, bilgi: 0.85, taktik: 0.85, dilim: 10 },
  { id: 5, etiket: _t("Çok Zor"),   aciklama: _t("İğne deliği kareler"),            kademe: 5, asgari: 3,  azami: 7,    un: 0,    bilgi: 0.95, taktik: 1.00, dilim: 6  },
];

export const VARSAYILAN_ZORLUK = 2;

// Seviyeye göre ızgarada kullanılabilecek kulüpler. Kademeler BİRİKİMLİ:
// üst seviye alttakinin havuzunu da içeriyor.
const KADEME_1 = temizle(MEGA);
const KADEME_2 = temizle([...MEGA, ...BIG]);
const KADEME_3 = temizle([...MEGA, ...BIG, ...CHAMPIONS_LEAGUE_CLUBS]);
const KADEME_4 = temizle([...MEGA, ...BIG, ...CHAMPIONS_LEAGUE_CLUBS, ...WELL_KNOWN_EXTRA]);

export function zorlukAyari(seviye = VARSAYILAN_ZORLUK) {
  // 27 Eylül 2026: hazır bir ayar nesnesi de verilebilir (bkz. zorlukAyari10).
  if (seviye && typeof seviye === "object") return seviye;
  return ZORLUKLAR.find((z) => z.id === seviye) || ZORLUKLAR[VARSAYILAN_ZORLUK - 1];
}

// 27 Eylül 2026 (Kerem: "her mod için 10 üstünden zorluk") — 1-10 ölçeği.
// Izgaranın kulüp havuzu ve kare eşikleri 5 kademeden (1-2 -> 1, ..., 9-10 -> 5)
// geliyor; CPU'nun isim hatırlama ("bilgi") ve kare seçme ("taktik") gücü ise
// 10 kademenin her birinde ayrı (doğrusal ara değer).
export function zorlukAyari10(z = 4) {
  const n = Math.min(10, Math.max(1, Math.round(z)));
  const temel = ZORLUKLAR[Math.ceil(n / 2) - 1];
  const t = (n - 1) / 9;
  const ilk = ZORLUKLAR[0], son = ZORLUKLAR[ZORLUKLAR.length - 1];
  return {
    ...temel,
    zorluk: n,
    bilgi: ilk.bilgi + (son.bilgi - ilk.bilgi) * t,
    taktik: ilk.taktik + (son.taktik - ilk.taktik) * t,
  };
}

export function seviyeHavuzu(seviye = VARSAYILAN_ZORLUK) {
  const k = zorlukAyari(seviye).kademe;
  if (k <= 1) return KADEME_1;
  if (k === 2) return KADEME_2;
  if (k === 3) return KADEME_3;
  if (k === 4) return KADEME_4;
  return TANIDIK;
}

// --- Kulüp ikilisi sayaç tablosu (bir kez kurulup önbelleğe alınıyor) -------
// Izgara üretimi "şu iki kulübün kaç ortak oyuncusu var" sorusunu yüzlerce kez
// soruyor. playersForPair her seferinde 46 bin oyuncuyu tararsa üretim
// saniyeler sürer; bu tablo tek geçişte kuruluyor ve sorgu O(1) oluyor.
let _sayacOnbellek = null;

export function ikiliSayaclari(veriSeti) {
  if (_sayacOnbellek) return _sayacOnbellek;
  const tanidikSet = new Set(TANIDIK);
  const sayac = new Map();
  for (const p of veriSeti) {
    const kulupler = [];
    for (const c of p.clubs || []) {
      const k = canonicalClub(c) || c;
      if (tanidikSet.has(k) && !kulupler.includes(k)) kulupler.push(k);
    }
    for (let i = 0; i < kulupler.length; i++) {
      for (let j = i + 1; j < kulupler.length; j++) {
        const anahtar = [kulupler[i], kulupler[j]].sort().join("|");
        sayac.set(anahtar, (sayac.get(anahtar) || 0) + 1);
      }
    }
  }
  _sayacOnbellek = sayac;
  return sayac;
}

export function ikiliSayisi(sayac, a, b) {
  if (a === b) return 0;
  return sayac.get([a, b].sort().join("|")) || 0;
}

// --- Izgara üretimi ---------------------------------------------------------
// 3 satır + 3 sütun kulübü seçiyoruz; DOKUZ kesişimin hepsinde yeterli ortak
// oyuncu olmak zorunda. Rastgele deneme yerine artımlı seçim (her yeni kulüp,
// seçili olanların hepsiyle uyumlu mu) çok daha hızlı sonuç veriyor.
// Fisher-Yates — verilen üreteçle karıştırır (test edilebilirlik için
// rastgeleliği dışarıdan alıyoruz).
// Ün ağırlığı 0 ise saf karıştırma, büyüdükçe ünlü kulüpler öne geliyor —
// ama rastgelelik hep korunuyor, yoksa her "Çok Kolay" ızgara aynı olurdu.
// 28 Eylül 2026 — Eşleşme Profili (lib/eslesmeProfili.js): izgaraUret çalışırken
// geçerli profil. Kulüp sırası profilin kulüp ağırlığına göre eğilir (Türkiye
// ağırlıklı profilde Türk kulüpleri satır/sütunlara daha sık girer).
let _profil = null;
function profilEgilimi(c) {
  if (!_profil) return 0;
  const w = _profil.kulupCarpani(c);
  return w > 0 ? 0.35 * Math.log2(w) : -5;
}

function unlulereEgilimliSirala(havuz, unAgirligi, rastgele) {
  if (!unAgirligi && !_profil) return karistir(havuz, rastgele);
  return [...havuz]
    .map((c) => ({ c, anahtar: rastgele() - (unAgirligi || 0) * (unPuani(c) / 3) - profilEgilimi(c) }))
    .sort((a, b) => a.anahtar - b.anahtar)
    .map((x) => x.c);
}

function karistir(dizi, rastgele) {
  const a = [...dizi];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rastgele() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// secenekler.gecmis: true → bu oturumda son ızgaralarda çıkan kulüpler cezalandırılır
// (art arda maçlarda aynı takımlar gelmesin). Günlük ızgara gibi herkese aynı
// olması gereken (tohumlu) üretimlerde KAPALI kalır.
export function izgaraUret(veriSeti, seviye = VARSAYILAN_ZORLUK, rastgele = Math.random, tur = "kulup", profil = null, secenekler = {}) {
  _profil = profil && typeof profil.kulupCarpani === "function" ? profil : null;
  try {
    let iz = null;
    if (!tur || tur === "kulup") iz = cesitliIzgaraUret(veriSeti, zorlukAyari(seviye), rastgele, !!secenekler.gecmis);
    else iz = kosulluIzgaraUret(veriSeti, zorlukAyari(seviye), rastgele, !!secenekler.gecmis, tur);
    if (iz) iz = { ...iz, seviye };
    else iz = izgaraUretIc(veriSeti, seviye, rastgele, tur);
    if (iz && secenekler.gecmis) gecmiseEkle([...iz.satirlar, ...iz.sutunlar]);
    return iz;
  } finally {
    _profil = null;
  }
}

// ============================================================================
// Paket 42 — ÇEŞİTLİ IZGARA (26 Ekim 2026)
// Kerem: "xox online'da hep aynı takımlar geliyor. eşleşme profili hiç işe
// yaramıyor. çok çeşitli ve ayarlanabilir olmalı. çok sayıda simülasyon yapıp
// dediğim durumu incele."
//
// ÖLÇÜM (t42/sim42.mjs, 300'er ızgara, eski üretici):
//   • Dereceli (Dengeli, zorluk 4): Galatasaray ızgaraların %62'sinde, iki maç
//     arasında 6 kulübün ortalama 2'si aynı; 300 ızgarada yalnız 36 farklı kulüp.
//   • Zorluk 6: 300 ızgarada 55 farklı ızgara, Marseille %95.
//   • İngilizce varsayılan (Şampiyonlar Ligi): 300'de 17 farklı ızgara.
//   • "Türkiye" profili: Liverpool %82, M. City %73 — Türk kulübü yok denecek kadar az.
// KÖK NEDENLER:
//   1) Havuz sabit 53 kulüptü (5 Kulüp listesi). Bursaspor, Başakşehir, Sivasspor,
//      Antalyaspor… hiç yoktu; profil Türk kulübü isteyince verecek kulüp yoktu.
//   2) Zorluk eşiği HAM ortak oyuncu sayısıydı (Kolay: kare başına ≥20). Bunu
//      yalnız birbirine çok oyuncu vermiş "merkez" kulüpler (İngiliz devleri,
//      Türk büyükleri) sağlıyordu → hep aynı kulüpler.
//   3) Profil sıralamaya log ölçekli küçük bir eğilim olarak giriyordu (etkisiz).
// YENİ:
//   • Havuz: en az 25 TANINMIŞ (tanınırlık ≥ 90) oyuncusu olan bütün kulüpler
//     (~250; rezerv takımlar hariç). Profil bu havuzu süzer ve ağırlıklandırır.
//   • Zorluk TANINMIŞ ortak oyuncu sayısıyla: Kolay = karede en az 4 tanınmış
//     (≥95) isim gibi. Böylece "kolay" kare gerçekten bilinir isimlerle dolu ama
//     kulüpler merkezle sınırlı değil.
//   • Seçim ağırlıklı rastgele: ağırlık = profil çarpanı × ün (kolayda ünlüye
//     eğilim) ÷ √(uyumlu kulüp sayısı) — merkez kulüplerin her ızgaraya girmesi
//     engellenir. Son ızgaralarda çıkan kulüpler (oturum içinde) ×0,15.
// ============================================================================
const GENIS_TANINMIS_ESIK = 90;      // havuza girmek için "tanınmış" sayılan oyuncu
const GENIS_ASGARI_OYUNCU = 25;      // ... ve kulübün en az bu kadar tanınmış oyuncusu
// zorluk (1-10) → kare kuralı: esik üstü tanınırlıkta en az `asgari` ortak oyuncu;
// hamAzami: kare başına toplam ortak oyuncu üst sınırı (zorlarda bedava kare olmasın);
// unUs: ünlü kulübe eğilim (0 = yok).
export function kareKurali(z) {
  const n = Math.min(10, Math.max(1, Math.round(z || 4)));
  if (n <= 2) return { esik: 95, asgari: 6, hamAzami: null, unUs: 1.2 };
  if (n <= 4) return { esik: 95, asgari: 4, hamAzami: null, unUs: 0.8 };
  if (n <= 6) return { esik: 92, asgari: 3, hamAzami: null, unUs: 0.4 };
  if (n <= 8) return { esik: 88, asgari: 2, hamAzami: 25, unUs: 0.1 };
  return { esik: 0, asgari: 3, hamAzami: 10, unUs: 0 };
}

let _genis = null;   // { veri, havuz, un: Map, ikili: Map<esik, Map> , ham: Map }
function genisVeri(veriSeti) {
  if (_genis && _genis.veri === veriSeti) return _genis;
  const un = new Map();
  const kulupleri = (p) => {
    const k = [];
    for (const c of p.clubs || []) {
      const a = canonicalClub(c) || c;
      if (!k.includes(a)) k.push(a);
    }
    return k;
  };
  for (const p of veriSeti) {
    if (taninirlik(p) < GENIS_TANINMIS_ESIK) continue;
    for (const c of kulupleri(p)) un.set(c, (un.get(c) || 0) + 1);
  }
  const havuz = [...un.entries()]
    .filter(([c, n]) => n >= GENIS_ASGARI_OYUNCU && !rezervTakimMi(c))
    .map(([c]) => c);
  const havuzSet = new Set(havuz);
  const ham = new Map();
  const ikili = new Map();   // esik -> Map
  const ESIKLER = [95, 92, 88];
  for (const e of ESIKLER) ikili.set(e, new Map());
  for (const p of veriSeti) {
    const k = kulupleri(p).filter((c) => havuzSet.has(c));
    if (k.length < 2) continue;
    const t = taninirlik(p);
    for (let i = 0; i < k.length; i++) {
      for (let j = i + 1; j < k.length; j++) {
        const a = k[i] < k[j] ? k[i] + "|" + k[j] : k[j] + "|" + k[i];
        ham.set(a, (ham.get(a) || 0) + 1);
        for (const e of ESIKLER) if (t >= e) { const m = ikili.get(e); m.set(a, (m.get(a) || 0) + 1); }
      }
    }
  }
  _genis = { veri: veriSeti, havuz, un, ham, ikili };
  return _genis;
}
function ciftAnahtar(a, b) { return a < b ? a + "|" + b : b + "|" + a; }

// Oturum içi geçmiş: son 3 ızgaranın kulüpleri.
const GECMIS_UZUNLUK = 18;
let _gecmis = [];
function gecmiseEkle(kosullar) {
  _gecmis = [...kosullar, ..._gecmis].slice(0, GECMIS_UZUNLUK);
}
export function izgaraGecmisiniSifirla() { _gecmis = []; }

function agirlikliSec(adaylar, agirlik, rastgele) {
  let toplam = 0;
  const w = adaylar.map((c) => { const x = Math.max(0, agirlik(c)); toplam += x; return x; });
  if (toplam <= 0) return null;
  let r = rastgele() * toplam;
  for (let i = 0; i < adaylar.length; i++) { r -= w[i]; if (r <= 0) return adaylar[i]; }
  return adaylar[adaylar.length - 1];
}

// Tam havuzdaki uyumluluk (kural başına bir kez kurulur).
const _komsuOnbellek = new Map();
function tamKomsu(G, kural) {
  const anahtar = `${kural.esik}|${kural.asgari}|${kural.hamAzami}`;
  const hazir = _komsuOnbellek.get(anahtar);
  if (hazir && hazir.G === G) return hazir.komsu;
  const sayilar = kural.esik ? G.ikili.get(kural.esik) : G.ham;
  const komsu = new Map();
  for (const c of G.havuz) komsu.set(c, new Set());
  for (const [k, n] of sayilar) {
    if (n < kural.asgari) continue;
    const h = G.ham.get(k) || 0;
    if (h < ASGARI_HUCRE_CEVAP || (kural.hamAzami != null && h > kural.hamAzami)) continue;
    const i = k.indexOf("|");
    const a = k.slice(0, i), b = k.slice(i + 1);
    if (komsu.has(a) && komsu.has(b)) { komsu.get(a).add(b); komsu.get(b).add(a); }
  }
  _komsuOnbellek.set(anahtar, { G, komsu });
  return komsu;
}

function cesitliIzgaraUret(veriSeti, ayar, rastgele, gecmisKullan) {
  if (!veriSeti || !veriSeti.length) return null;
  const G = genisVeri(veriSeti);
  const z = ayar.zorluk ?? (ayar.id ? ayar.id * 2 : 4);
  const kural = kareKurali(z);
  const tam = tamKomsu(G, kural);
  const profilW = (c) => (_profil ? _profil.kulupCarpani(c) : 1);
  const gecmis = gecmisKullan ? new Set(_gecmis) : null;
  let unMax = 1;
  for (const v of G.un.values()) if (v > unMax) unMax = v;

  // Önce profilin izin verdiği havuzla; ızgara çıkmazsa profilsiz (yalnız ağırlık).
  const denemeler = _profil ? [true, false] : [false];
  for (const suz of denemeler) {
    const havuzSet = new Set(suz ? G.havuz.filter((c) => profilW(c) > 0) : G.havuz);
    if (havuzSet.size < 6) continue;
    const komsu = new Map();
    for (const c of havuzSet) {
      const n = new Set();
      for (const x of tam.get(c)) if (havuzSet.has(x)) n.add(x);
      komsu.set(c, n);
    }
    const adaylar = [...havuzSet].filter((c) => komsu.get(c).size >= 3);
    if (adaylar.length < 6) continue;
    const agirlik = (c) => {
      const pw = suz ? profilW(c) : Math.max(0.25, profilW(c));
      const unB = Math.pow((G.un.get(c) || 1) / unMax, kural.unUs);
      const ceza = gecmis && gecmis.has(c) ? 0.15 : 1;
      return (pw * unB * ceza) / Math.sqrt(komsu.get(c).size);
    };
    // Tuttuğun takım: "Sık" seçiliyse ızgaraların çoğunda, "Normal"de üçte birinde.
    const takim = _profil && _profil.takim && komsu.has(_profil.takim) && komsu.get(_profil.takim).size >= 3 ? _profil.takim : null;
    const takimZorla = takim && rastgele() < Math.min(0.85, (_profil.takimOrani || 0) * 2.2);
    for (let deneme = 0; deneme < 300; deneme++) {
      const r1 = takimZorla && deneme < 100 ? takim : agirlikliSec(adaylar, agirlik, rastgele);
      if (!r1) break;
      const n1 = komsu.get(r1);
      // İkinci satır: birinci satırla en az 3 ortak uyumlu kulübü (sütun adayı) olmalı.
      const r2Aday = adaylar.filter((c) => {
        if (c === r1) return false;
        let k = 0; for (const x of komsu.get(c)) if (n1.has(x) && x !== r1) { k++; if (k >= 3) return true; } return false;
      });
      const r2 = agirlikliSec(r2Aday, agirlik, rastgele);
      if (!r2) continue;
      const n12 = [...n1].filter((x) => komsu.get(r2).has(x) && x !== r2);
      const r3Aday = adaylar.filter((c) => c !== r1 && c !== r2).filter((c) => {
        let k = 0; const nc = komsu.get(c); for (const x of n12) if (nc.has(x) && x !== c) { k++; if (k >= 3) return true; } return false;
      });
      const r3 = agirlikliSec(r3Aday, agirlik, rastgele);
      if (!r3) continue;
      const satirlar = karistir([r1, r2, r3], rastgele);
      let sutunAday = n12.filter((x) => komsu.get(r3).has(x) && !satirlar.includes(x));
      const sutunlar = [];
      while (sutunlar.length < 3 && sutunAday.length) {
        const c = agirlikliSec(sutunAday, agirlik, rastgele);
        if (!c) break;
        sutunlar.push(c);
        sutunAday = sutunAday.filter((x) => x !== c);
      }
      if (sutunlar.length === 3) return { satirlar, sutunlar, asgari: kural.asgari, kural };
    }
  }
  return null;
}

// Paket 42 — karma/ülke/başarı ızgaraları da çeşitli kulüp ızgarasından türer:
// 1-2 sütun, üç satır kulübüyle de yeterli (tanınmış) ortak oyuncusu olan bir
// koşulla (ülke / başarı) değiştirilir.
function kosulluIzgaraUret(veriSeti, ayar, rastgele, gecmisKullan, tur) {
  const ekler = ekKosulHavuzu(tur);
  if (!ekler.length) return null;
  const kural = kareKurali(ayar.zorluk ?? (ayar.id ? ayar.id * 2 : 4));
  const kosulluUst = kural.hamAzami != null ? kural.hamAzami * 3 : 150;
  const say = (a, b) => {
    const A = kosulKumesi(veriSeti, a), B = kosulKumesi(veriSeti, b);
    const [kucuk, buyuk] = A.size <= B.size ? [A, B] : [B, A];
    let ham = 0, tan = 0;
    for (const i of kucuk) if (buyuk.has(i)) { ham++; if (!kural.esik || taninirlik(veriSeti[i]) >= kural.esik) tan++; }
    return { ham, tan };
  };
  const uygun = (a, b) => {
    const { ham, tan } = say(a, b);
    return ham >= ASGARI_HUCRE_CEVAP && tan >= kural.asgari && ham <= kosulluUst;
  };
  for (let deneme = 0; deneme < 25; deneme++) {
    const taban = cesitliIzgaraUret(veriSeti, ayar, rastgele, gecmisKullan);
    if (!taban) return null;
    const kosulSayisi = rastgele() < 0.5 ? 1 : 2;
    const secilen = [];
    for (const k of karistir(ekler, rastgele)) {
      if (secilen.length >= kosulSayisi) break;
      if (taban.satirlar.every((sa) => uygun(sa, k))) secilen.push(k);
    }
    if (!secilen.length) continue;
    const kalan = karistir(taban.sutunlar, rastgele).slice(0, 3 - secilen.length);
    return { satirlar: taban.satirlar, sutunlar: karistir([...secilen, ...kalan], rastgele), asgari: kural.asgari, tur };
  }
  return null;
}

function izgaraUretIc(veriSeti, seviye, rastgele, tur) {
  const sayac = ikiliSayaclari(veriSeti);
  const ayar = zorlukAyari(seviye);
  let kademe = seviyeHavuzu(seviye);
  if (_profil) {
    // Profilin dışarıda bıraktığı kulüpler ızgaraya girmesin — ama havuz
    // ızgara kuramayacak kadar daralırsa (ör. "Sadece Süper Lig" + Çok Kolay)
    // profili sadece sıralamada kullanıp havuzu olduğu gibi bırakıyoruz.
    const suzulmus = kademe.filter((c) => _profil.kulupCarpani(c) > 0);
    if (suzulmus.length >= 10) kademe = suzulmus;
  }
  if (tur && tur !== "kulup") {
    const karma = karmaIzgaraUret(veriSeti, sayac, ayar, kademe, tur, rastgele);
    if (karma) return { ...karma, seviye };
    // Karma kurulamadıysa düz kulüp ızgarasına düş (oyun yine de başlasın).
  }

  // Asgari eşik bu havuzda ızgara kurmayı imkansız kılıyorsa kademe kademe
  // gevşetiyoruz — oyuncuya "ızgara üretilemedi" demektense biraz daha zor bir
  // ızgara vermek her zaman daha iyi.
  //
  // AMA gevşeme YUMUŞAK olmalı: ilk sürümde merdiven [asgari, asgari/2, 3] idi
  // ve "Çok Kolay"da tek bir başarısız denemeden sonra doğrudan 3'e düşüyordu —
  // ölçümde Çok Kolay ızgaranın en zayıf karesi 6 cevaba kadar indi, yani
  // seviyenin verdiği söz tutulmuyordu. Artık taban seviyeye göre ölçekleniyor.
  const merdiven = [
    ayar.asgari,
    Math.ceil(ayar.asgari * 0.6),
    Math.max(ASGARI_HUCRE_CEVAP, Math.ceil(ayar.asgari * 0.35)),
  ];
  for (const asgari of merdiven) {
    const izgara = izgaraDene(kademe, sayac, asgari, ayar.azami, ayar.un || 0, rastgele);
    if (izgara) return { ...izgara, seviye, asgari };
  }
  // Azami sınır yüzünden çıkmadıysa onu kaldırıp son bir deneme.
  const sonCare = izgaraDene(kademe, sayac, ASGARI_HUCRE_CEVAP, null, ayar.un || 0, rastgele);
  return sonCare ? { ...sonCare, seviye, asgari: ASGARI_HUCRE_CEVAP } : null;
}

// Karma ızgara: satırlar kulüp, sütunlarda 1-2 koşul (ülke/başarı) + kulüp.
// Koşullu kareler kulüp×kulüp karelerinden genelde daha kalabalık olduğu için
// aynı asgari/azami eşikleri kullanılıyor; azami sadece kulüp×kulüp'e uygulanır.
function karmaIzgaraUret(veriSeti, sayac, ayar, kademe, tur, rastgele) {
  const ekler = ekKosulHavuzu(tur);
  if (!ekler.length) return null;
  const say = (a, b) =>
    kosulTuru(a) === "kulup" && kosulTuru(b) === "kulup" ? ikiliSayisi(sayac, a, b) : kosulKesisimSayisi(veriSeti, a, b);
  const merdiven = [ayar.asgari, Math.ceil(ayar.asgari * 0.6), ASGARI_HUCRE_CEVAP];
  for (const asgari of merdiven) {
    const uygun = (a, b) => {
      const n = say(a, b);
      if (n < asgari) return false;
      if (ayar.azami != null && kosulTuru(a) === "kulup" && kosulTuru(b) === "kulup" && n > ayar.azami) return false;
      // "İngiltere × Arsenal" gibi yüzlerce cevaplı bedava kareler olmasın.
      const kosulluUst = ayar.azami != null ? ayar.azami * 3 : 150;
      if ((kosulTuru(a) !== "kulup" || kosulTuru(b) !== "kulup") && n > kosulluUst) return false;
      return true;
    };
    for (let deneme = 0; deneme < 150; deneme++) {
      const satirlar = [];
      for (const c of unlulereEgilimliSirala(kademe, ayar.un || 0, rastgele)) {
        if (satirlar.length >= 3) break;
        if (!satirlar.includes(c)) satirlar.push(c);
      }
      if (satirlar.length < 3) return null;
      const kosulSayisi = rastgele() < 0.5 ? 1 : 2;
      const sutunlar = [];
      for (const k of karistir(ekler, rastgele)) {
        if (sutunlar.length >= kosulSayisi) break;
        // Aynı türden iki ülke yan yana (Brezilya × Arjantin gibi) sütunda sorun
        // değil — satırlar kulüp olduğu için kesişim hep kulüp × koşul.
        if (satirlar.every((sa) => uygun(sa, k))) sutunlar.push(k);
      }
      if (!sutunlar.length) continue;
      for (const c of unlulereEgilimliSirala(kademe, ayar.un || 0, rastgele)) {
        if (sutunlar.length >= 3) break;
        if (satirlar.includes(c) || sutunlar.includes(c)) continue;
        if (satirlar.every((sa) => uygun(sa, c))) sutunlar.push(c);
      }
      if (sutunlar.length === 3) {
        // Koşullar sütunlarda karışık dursun (hep başta olmasın).
        return { satirlar, sutunlar: karistir(sutunlar, rastgele), asgari, tur };
      }
    }
  }
  return null;
}

// `azami`: en zor seviyelerde kesişimlerin BOL olmamasını da şart koşuyoruz —
// yoksa "Real Madrid × Barcelona" (onlarca ortak isim) zor ızgaraya sızıyor ve
// seviye farkı hissedilmiyor.
function uygunIkili(sayac, a, b, asgari, azami) {
  const n = ikiliSayisi(sayac, a, b);
  if (n < asgari) return false;
  if (azami != null && n > azami) return false;
  return true;
}

function izgaraDene(kademe, sayac, asgari, azami, unAgirligi, rastgele) {
  const havuz = kademe.filter((c) =>
    // Bu havuzda uygun ortağı olmayan kulüpler baştan elensin.
    kademe.some((d) => d !== c && uygunIkili(sayac, c, d, asgari, azami))
  );
  if (havuz.length < 6) return null;

  for (let deneme = 0; deneme < 200; deneme++) {
    const satirlar = [];
    const sutunlar = [];
    const karistirilmis = unlulereEgilimliSirala(havuz, unAgirligi, rastgele);

    for (const aday of karistirilmis) {
      if (satirlar.length < 3) {
        // Satır kulüpleri birbirinden farklı olsun; sütunlarla uyum sonra.
        if (!satirlar.includes(aday)) satirlar.push(aday);
        continue;
      }
      if (sutunlar.length >= 3) break;
      if (satirlar.includes(aday) || sutunlar.includes(aday)) continue;
      // Aday sütun, ÜÇ satırın da hepsiyle yeterli ortak oyuncuya sahip olmalı.
      if (satirlar.every((s) => uygunIkili(sayac, s, aday, asgari, azami))) sutunlar.push(aday);
    }

    if (satirlar.length === 3 && sutunlar.length === 3) {
      return { satirlar, sutunlar };
    }
  }
  return null;
}

// Bir hücrenin geçerli cevapları.
export function hucreCevaplari(veriSeti, izgara, satir, sutun) {
  const a = izgara.satirlar[satir], b = izgara.sutunlar[sutun];
  if (kosulTuru(a) === "kulup" && kosulTuru(b) === "kulup") return playersForPair(veriSeti, a, b);
  return veriSeti.filter((p) => kosulSaglar(p, a) && kosulSaglar(p, b));
}

// --- Oyun durumu ------------------------------------------------------------
// PERFORMANS: dokuz karenin geçerli cevapları BURADA, bir kez hesaplanıyor.
// Başta her kontrolde playersForPair çağrılıyordu (46 bin oyuncu taraması);
// "bu karede kullanılmamış cevap kaldı mı" kontrolü her hamlede dokuz kez
// çalıştığı için maç simülasyonu dakikalarca sürdü. Bir ızgaranın cevapları
// değişmez, o yüzden tek seferlik.
// 4 Ekim 2026 — ÇALMA KURALI (benchmark .29313: "oyuncu başı 3 hak, varsayılan
// açık"). Rakibin aldığı kareye dokunup o kare için FARKLI geçerli bir futbolcu
// söylersen kare senin olur. Her oyuncunun 3 çalma hakkı var; deneme başarısız
// olsa da hak gider (yoksa bedava denenirdi). secenekler.calma === false → kapalı.
export const CALMA_HAKKI = 3;

// ============================================================================
// Paket 42 (26 Ekim 2026) — Kerem:
//   "xox çok bilen yenmesin, çizgi yapmak zorunlu olsun. bir taraf 5 diğer taraf
//    4 yazınca galibiyet olmasın." → Tahta dolup çizgi yoksa BERABERE.
//   "uzatma istenip istenmediği oyun ayarlarında belli olsun" → secenekler.uzatma:
//    berabere yerine bir kez YENİ IZGARA ile uzatma (ilk çizgi kazanır; uzatma da
//    çizgisiz biterse berabere).
//   "hiç kimse hiçbir ismi bilemezse ... 3 pastan sonra otomatik berabere" →
//    art arda ARDISIK_BASARISIZ_SINIR başarısız hamle (iki taraf 3'er: pas,
//    yanlış, süre) → berabere. "Pas" artık kare seçmeden de yapılabilir
//    (ekranda "Bilemedim").
//   "katlamalı mod: ben söyledim bir kare, karşımdaki o kareyi aldı, ben geri
//    aldım derken bilemeyene kadar geri alınabilsin" → secenekler.katlama
//    (Kerem'in seçtiği kurgu: ANINDA DÜELLO). Rakibin karesine FARKLI bir isim
//    söyleyip alırsan kare sahibi HEMEN geri almayı dener; zincir biri bilemeyene
//    kadar sürer. O karede söylenen hiçbir isim tekrar edilemez. Çalma hakkı
//    sınırı yok. Düello bitince sıra, düelloyu başlatanın rakibine geçer
//    (düello saldıranın hamlesi sayılır); çizgi kontrolü düello bitince yapılır.
// ============================================================================
export const ARDISIK_BASARISIZ_SINIR = 6;

export const CALMA_KURALLARI = [
  { deger: "kapali", etiket: _t("Kapalı") },
  { deger: "hak", etiket: _t("3 çalma hakkı") },
  { deger: "katlama", etiket: _t("Katlamalı") },
];
// Eski kayıtlar (true/false) ve yeni kural adları tek yerden çözülsün.
export function calmaKuraliCoz(k) {
  if (k === true || k === "hak") return "hak";
  if (k === "katlama") return "katlama";
  return "kapali";
}

export function baslangicDurumu(izgara, ilkOynayan = X, veriSeti = null, secenekler = {}) {
  const hucreAdlari = veriSeti ? hucreAdlariniHesapla(veriSeti, izgara) : null;
  const katlama = !!secenekler.katlama;
  const hakli = !katlama && secenekler.calma !== false && secenekler.calma !== "kapali";
  return {
    izgara,
    hucreAdlari,
    tahta: [null, null, null, null, null, null, null, null, null], // "x" | "o" | null
    sira: ilkOynayan,
    secili: null,          // { satir, sutun, calma?, duello? } — cevap bekleyen hücre
    kullanilanlar: [],     // hamle kaydi (kural degil) — ekranda gosteriliyor
    hucreSahipleri: {},    // "0-2" -> { oyuncu: "x", ad: "Deco" }
    sonHamle: null,        // { tip, kimden, metin, ad }
    hamleNo: 0,            // her tamamlanan hamlede (cevap/pas/süre) artar — sayaç sıfırlama için
    bitti: false,
    kazanan: null,         // "x" | "o" | "berabere"
    kazananCizgi: null,    // [i, j, k]
    bitisSebebi: null,     // "cizgi" | "dolu" | "pas"
    calmaHakki: hakli ? { [X]: CALMA_HAKKI, [O]: CALMA_HAKKI } : null,
    katlama,
    kareIsimleri: {},      // indis -> o karede söylenmiş bütün isimler (katlamada tekrar yasak)
    duello: null,          // { indis, baslatan } — katlamada süren düello
    uzatma: !!secenekler.uzatma,
    uzatmaNo: 0,           // 1 = uzatma ızgarasında oynanıyor
    uzatmaBekliyor: false, // tahta çizgisiz doldu, ekran/host yeni ızgara gönderecek
    basarisizSeri: 0,      // art arda başarısız hamle sayısı
  };
}

function sadeAd(s) {
  return String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim();
}

function hucreAdlariniHesapla(veriSeti, izgara) {
  return Array.from({ length: 9 }, (_, i) =>
    hucreCevaplari(veriSeti, izgara, Math.floor(i / 3), i % 3).map((p) => p.name));
}

// Sıradaki oyuncu bu kareyi çalabilir mi?
export function calinabilirMi(durum, indis) {
  const sahip = durum && durum.tahta[indis];
  if (!sahip || sahip === durum.sira || durum.duello) return false;
  if (durum.katlama) return true;
  if (!durum.calmaHakki) return false;
  return (durum.calmaHakki[durum.sira] || 0) > 0;
}

export const KAZANAN_CIZGILER = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function kazananBul(tahta) {
  for (const c of KAZANAN_CIZGILER) {
    const [a, b, d] = c;
    if (tahta[a] && tahta[a] === tahta[b] && tahta[a] === tahta[d]) {
      return { kazanan: tahta[a], cizgi: c };
    }
  }
  return null;
}

export function bosHucreler(tahta) {
  const s = [];
  for (let i = 0; i < 9; i++) if (!tahta[i]) s.push(i);
  return s;
}

function digeri(o) {
  return o === X ? O : X;
}

// 25 Eylul 2026 (Kerem: "xox'te ayni futbolcu kullanilabilir, kisitlama yok")
// — "bir futbolcu macta bir kez" kurali KALDIRILDI. Bir kare artik ASLA
// "tukenemez" (cevabi varsa hep alinabilir); kareTukendiMi yalnizca "hic
// cevabi olmayan kare" durumunu koruyor. durum.kullanilanlar bir KURAL degil,
// ekranda gosterilen hamle kaydi. (Katlamada yasak olan, ayni KAREDE ayni ismin
// tekrari — bkz. durum.kareIsimleri.)
export function kareTukendiMi(durum, satir, sutun, veriSeti) {
  const indis = satir * 3 + sutun;
  const adlar = durum.hucreAdlari
    ? durum.hucreAdlari[indis]
    : hucreCevaplari(veriSeti, durum.izgara, satir, sutun).map((p) => p.name);
  return !adlar || adlar.length === 0;
}

// Boş karelerden en az biri hâlâ doldurulabilir mi?
export function oynanabilirKareVar(durum, veriSeti) {
  for (const i of bosHucreler(durum.tahta)) {
    if (!kareTukendiMi(durum, Math.floor(i / 3), i % 3, veriSeti)) return true;
  }
  return false;
}

// Paket 42: çizgi yoksa kazanan YOK. Tahta (ya da oynanabilir kare) bittiğinde
// berabere — uzatma açıksa ve henüz kullanılmadıysa uzatma beklenir.
function bitisiHesapla(tahta, durum, veriSeti) {
  const k = kazananBul(tahta);
  if (k) return { bitti: true, kazanan: k.kazanan, kazananCizgi: k.cizgi, bitisSebebi: "cizgi", uzatmaBekliyor: false };
  const kilitli = durum && (durum.hucreAdlari || veriSeti) && !oynanabilirKareVar({ ...durum, tahta }, veriSeti);
  if (bosHucreler(tahta).length === 0 || kilitli) {
    if (durum && durum.uzatma && !durum.uzatmaNo) {
      return { bitti: false, kazanan: null, kazananCizgi: null, bitisSebebi: null, uzatmaBekliyor: true };
    }
    return { bitti: true, kazanan: "berabere", kazananCizgi: null, bitisSebebi: "dolu", uzatmaBekliyor: false };
  }
  return { bitti: false, kazanan: null, kazananCizgi: null, bitisSebebi: null, uzatmaBekliyor: false };
}

// Başarısız hamle (yanlış / pas / süre): seri artar, sınıra varınca berabere.
function basarisizSonrasi(durum, ek) {
  const seri = (durum.basarisizSeri || 0) + 1;
  const sonuc = { ...durum, ...ek, basarisizSeri: seri, hamleNo: (durum.hamleNo || 0) + 1 };
  if (seri >= ARDISIK_BASARISIZ_SINIR) {
    return { ...sonuc, secili: null, duello: null, bitti: true, kazanan: "berabere", kazananCizgi: null, bitisSebebi: "pas" };
  }
  return sonuc;
}

// Düello sırasında biri bilemedi/pas/süre: düello biter, kare son alanda kalır,
// sıra düelloyu başlatanın rakibine geçer, çizgi kontrolü yapılır.
function duelloBitir(durum, sonHamle, veriSeti) {
  const d = durum.duello;
  const bitis = bitisiHesapla(durum.tahta, durum, veriSeti);
  const sonuc = {
    ...durum,
    secili: null,
    duello: null,
    sira: bitis.bitti ? durum.sira : digeri(d.baslatan),
    sonHamle: { ...sonHamle, duelloBitti: true },
    hamleNo: (durum.hamleNo || 0) + 1,
    ...bitis,
  };
  return sonuc;
}

// Aksiyonlar: hücre seç, cevap ver, pas geç, süre doldu, uzatma.
export function aksiyonuIsle(durum, aksiyon, baglam) {
  if (!durum || durum.bitti || !aksiyon) return null;
  const { veriSeti } = baglam || {};
  if (durum.uzatmaBekliyor && aksiyon.tip !== "uzatma") return null;

  switch (aksiyon.tip) {
    case "hucreSec": {
      if (durum.duello) return null;   // düelloda kare zaten belli
      const { satir, sutun } = aksiyon;
      const indis = satir * 3 + sutun;
      if (durum.tahta[indis]) {
        // Rakibin karesi: çalma (hak) ya da katlama ile seçilir.
        if (!calinabilirMi(durum, indis)) return null;
        return { ...durum, secili: { satir, sutun, calma: true }, sonHamle: null };
      }
      return { ...durum, secili: { satir, sutun }, sonHamle: null };
    }

    case "secimiIptal":
      if (!durum.secili || durum.duello) return null;
      return { ...durum, secili: null };

    case "cevap": {
      if (!durum.secili) return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;

      const { satir, sutun, calma } = durum.secili;
      const indis = satir * 3 + sutun;
      const adaylar = hucreCevaplari(veriSeti, durum.izgara, satir, sutun);
      // Çalmada karenin ŞU ANKİ cevabı geçmez; katlamada o karede söylenmiş
      // HİÇBİR isim geçmez. Yasaklılar hariç adaylarda aranır ("Silva" → öbür Silva).
      const mevcutAd = calma ? durum.hucreSahipleri[`${satir}-${sutun}`]?.ad : null;
      const yasak = new Set(durum.katlama ? (durum.kareIsimleri?.[indis] || []) : mevcutAd ? [mevcutAd] : []);
      // Yasaklı ismin TAM adını yazdıysa ("Ahmet Kare") aynı soyadlı başka biri
      // ("Mehmet Kare") yerine sayılmasın — bu, aynı ismi tekrar etmektir.
      const tamYasak = yasak.size > 0 && [...yasak].some((y) => sadeAd(y) === sadeAd(metin));
      let eslesen = tamYasak ? null : findMatchedPlayer(metin, yasak.size ? adaylar.filter((p) => !yasak.has(p.name)) : adaylar);
      const ayniIsim = !eslesen && yasak.size > 0 && (tamYasak || yasak.has(findMatchedPlayer(metin, adaylar)?.name));
      const hakDusur = calma && durum.calmaHakki && !durum.katlama;
      const calmaHakki = hakDusur
        ? { ...durum.calmaHakki, [durum.sira]: Math.max(0, (durum.calmaHakki[durum.sira] || 0) - 1) }
        : durum.calmaHakki;

      if (!eslesen) {
        const sonHamle = { tip: "yanlis", kimden: durum.sira, metin, ad: null, calma: !!calma, ayniIsim, duello: !!durum.duello };
        if (durum.duello) return duelloBitir({ ...durum, basarisizSeri: 0 }, sonHamle, veriSeti);
        // Yanlış cevap: kare alınmaz, sıra rakibe geçer.
        return basarisizSonrasi(durum, { secili: null, calmaHakki, sira: digeri(durum.sira), sonHamle });
      }

      const tahta = [...durum.tahta];
      tahta[indis] = durum.sira;
      const kareIsimleri = { ...(durum.kareIsimleri || {}), [indis]: [...((durum.kareIsimleri || {})[indis] || []), eslesen.name] };
      const ortak = {
        tahta,
        kullanilanlar: [...durum.kullanilanlar, eslesen.name],
        hucreSahipleri: { ...durum.hucreSahipleri, [`${satir}-${sutun}`]: { oyuncu: durum.sira, ad: eslesen.name } },
        kareIsimleri,
        calmaHakki,
        basarisizSeri: 0,
        hamleNo: (durum.hamleNo || 0) + 1,
      };

      // KATLAMA: rakibin karesini aldın (ya da düelloda geri aldın) → sıra
      // karşı tarafa, aynı kare için. Çizgi kontrolü düello bitince.
      if (durum.katlama && calma) {
        const baslatan = durum.duello ? durum.duello.baslatan : durum.sira;
        return {
          ...durum,
          ...ortak,
          duello: { indis, baslatan },
          sira: digeri(durum.sira),
          secili: { satir, sutun, calma: true, duello: true },
          sonHamle: { tip: "dogru", kimden: durum.sira, metin, ad: eslesen.name, calma: true, duello: !!durum.duello },
        };
      }

      const araDurum = { ...durum, ...ortak };
      const bitis = bitisiHesapla(tahta, araDurum, veriSeti);
      return {
        ...araDurum,
        secili: null,
        sira: bitis.bitti ? durum.sira : digeri(durum.sira),
        sonHamle: { tip: "dogru", kimden: durum.sira, metin, ad: eslesen.name, calma: !!calma },
        ...bitis,
      };
    }

    // "Pas" / "Bilemedim": kare seçili olsun olmasın sıra rakibe geçer.
    case "pas": {
      const sonHamle = { tip: "pas", kimden: durum.sira, metin: null, ad: null, duello: !!durum.duello };
      if (durum.duello) return duelloBitir(durum, sonHamle, veriSeti);
      // Çalma denemesinde pas: hak yanmaz (kare hiç denenmedi).
      return basarisizSonrasi(durum, { secili: null, sira: digeri(durum.sira), sonHamle });
    }

    // 26 Eylül 2026 (Kerem: "cevap başına süre sınırı") — süre dolunca sıra
    // rakibe geçer (kare seçilmemiş olsa da).
    case "sureDoldu": {
      const sonHamle = { tip: "sure", kimden: durum.sira, metin: null, ad: null, duello: !!durum.duello };
      if (durum.duello) return duelloBitir(durum, sonHamle, veriSeti);
      return basarisizSonrasi(durum, { secili: null, sira: digeri(durum.sira), sonHamle });
    }

    // Paket 42 — uzatma: tahta çizgisiz dolduktan sonra yeni ızgara.
    // aksiyon.izgara ekran (ya da online host) tarafından üretilir.
    case "uzatma": {
      if (!durum.uzatmaBekliyor || !aksiyon.izgara) return null;
      return {
        ...durum,
        izgara: aksiyon.izgara,
        hucreAdlari: durum.hucreAdlari && veriSeti ? hucreAdlariniHesapla(veriSeti, aksiyon.izgara) : null,
        tahta: [null, null, null, null, null, null, null, null, null],
        hucreSahipleri: {},
        kareIsimleri: {},
        secili: null,
        duello: null,
        uzatmaNo: 1,
        uzatmaBekliyor: false,
        basarisizSeri: 0,
        sonHamle: { tip: "uzatma", kimden: null },
        hamleNo: (durum.hamleNo || 0) + 1,
      };
    }

    default:
      return null;
  }
}

// --- CPU --------------------------------------------------------------------
// Zorluk iki ayrı şeyi birden ayarlıyor:
//   bilgi  : CPU'nun o kare için bir isim HATIRLAMA olasılığı
//   taktik : kareyi seçerken ne kadar akıllı davrandığı
// İkisini ayırmak önemliydi; sadece "bilgi"yi düşürmek CPU'yu aptal değil
// ŞANSSIZ yapar, sadece taktiği düşürmek ise yenilmez ama sıkıcı bir rakip
// bırakırdı.
// Hangi kareyi denesin? Önce kazandıran, sonra rakibi engelleyen kare;
// taktik olasılığı tutmazsa rastgele.
export function cpuHucreSec(durum, seviye = VARSAYILAN_ZORLUK, rastgele = Math.random, veriSeti = null) {
  let bos = bosHucreler(durum.tahta);
  // Tükenmiş kareleri (kullanılmamış cevabı kalmamış) hiç denemesin.
  if (durum.hucreAdlari || veriSeti) {
    const oynanabilir = bos.filter((i) => !kareTukendiMi(durum, Math.floor(i / 3), i % 3, veriSeti));
    if (oynanabilir.length) bos = oynanabilir;
  }
  const ayar = zorlukAyari(seviye);
  const ben = durum.sira;
  // Çalma: rakibin karesi CPU'nun ikilisini kesiyorsa (çalınca üçlü olur) dene;
  // boş kare kalmadıysa rastgele bir rakip karesini dene.
  if (durum.katlama || (durum.calmaHakki && (durum.calmaHakki[ben] || 0) > 0)) {
    const kazandiranCalma = kritikCalma(durum.tahta, ben);
    if (kazandiranCalma !== null && rastgele() < ayar.taktik) return kazandiranCalma;
    if (!bos.length) {
      const rakipKareleri = [];
      for (let i = 0; i < 9; i++) if (durum.tahta[i] && durum.tahta[i] !== ben) rakipKareleri.push(i);
      if (rakipKareleri.length) return rakipKareleri[Math.floor(rastgele() * rakipKareleri.length)];
    }
  }
  if (!bos.length) return null;

  if (rastgele() < ayar.taktik) {
    const kazandiran = kritikHucre(durum.tahta, ben);
    if (kazandiran !== null) return kazandiran;
    const engelleyen = kritikHucre(durum.tahta, digeri(ben));
    if (engelleyen !== null) return engelleyen;
    if (bos.includes(4)) return 4;                       // merkez
    const koseler = [0, 2, 6, 8].filter((i) => bos.includes(i));
    if (koseler.length) return koseler[Math.floor(rastgele() * koseler.length)];
  }
  return bos[Math.floor(rastgele() * bos.length)];
}

// Çalınınca oyuncuya üçlü kazandıracak rakip karesi.
function kritikCalma(tahta, oyuncu) {
  for (const [a, b, c] of KAZANAN_CIZGILER) {
    const dizi = [tahta[a], tahta[b], tahta[c]];
    const benim = dizi.filter((v) => v === oyuncu).length;
    const rakip = dizi.filter((v) => v && v !== oyuncu).length;
    if (benim === 2 && rakip === 1) return [a, b, c][dizi.findIndex((v) => v && v !== oyuncu)];
  }
  return null;
}

// Bir oyuncunun tek hamlede tamamlayabileceği çizgideki boş kare.
function kritikHucre(tahta, oyuncu) {
  for (const [a, b, c] of KAZANAN_CIZGILER) {
    const dizi = [tahta[a], tahta[b], tahta[c]];
    const benim = dizi.filter((v) => v === oyuncu).length;
    const bos = dizi.filter((v) => !v).length;
    if (benim === 2 && bos === 1) {
      return [a, b, c][dizi.findIndex((v) => !v)];
    }
  }
  return null;
}

// CPU o kare için bir isim bulabildi mi? Bulduysa adı, bulamadıysa null.
// Bilgi olasılığı tutarsa TANINIRLIĞA göre üst dilimden seçiyor — CPU'nun
// "Ronaldinho" demesi, veri setinin derinliklerinden bir isim çıkarmasından
// hem daha gerçekçi hem daha keyifli.
export function cpuCevapSec(durum, satir, sutun, baglam, seviye = VARSAYILAN_ZORLUK, rastgele = Math.random) {
  const ayar = zorlukAyari(seviye);
  if (rastgele() > ayar.bilgi) return null;

  const { veriSeti } = baglam || {};
  const tumu = hucreCevaplari(veriSeti, durum.izgara, satir, sutun);
  // Kural kalkti ama CPU'nun ayni ismi ust uste soylemesi aptal gorunur:
  // kullanilmamislari TERCIH ediyor, hepsi kullanilmissa tumune donuyor.
  const kullanilan = new Set(durum.kullanilanlar);
  // Çalmada karenin mevcut cevabı geçmez; katlamada o karede söylenmiş hiçbir isim.
  const mevcutAd = durum.hucreSahipleri && durum.hucreSahipleri[`${satir}-${sutun}`]?.ad;
  const yasak = new Set(durum.katlama ? ((durum.kareIsimleri || {})[satir * 3 + sutun] || []) : mevcutAd ? [mevcutAd] : []);
  const gecerli = yasak.size ? tumu.filter((p) => !yasak.has(p.name)) : tumu;
  const taze = gecerli.filter((p) => !kullanilan.has(p.name));
  const adaylar = taze.length ? taze : gecerli;
  // (tanınırlığa göre sıralayabilmek için tam nesnelere ihtiyaç var, bu yüzden
  //  burada önbellek değil gerçek liste kullanılıyor — hamle başına bir kez)
  if (!adaylar.length) return null;

  // 4 Ekim 2026 — CPU yalnızca zorluğuna göre tanıyabileceği oyuncuları bilir
  // (lib/taninirlik.js). Karenin bütün cevapları gurme isimlerse CPU bulamaz.
  const z = ayar.zorluk ?? (ayar.id ? ayar.id * 2 : 5);
  const bilinen = adaylar.filter((p) => cpuBilirMi(p.name, z));
  if (!bilinen.length) return null;
  const sirali = [...bilinen].sort((a, b) => recognitionScore(b) - recognitionScore(a));
  const ust = Math.max(1, Math.min(ayar.dilim, sirali.length));
  return sirali[Math.floor(rastgele() * ust)].name;
}

// Sonuç metni — ekranda tek yerden okunsun diye burada.
export function sonucMetni(durum, cpuyaKarsi) {
  if (!durum.bitti) return "";
  if (durum.kazanan === "berabere") {
    if (durum.bitisSebebi === "pas") return _t("Berabere — kimse bilemedi");
    if (durum.bitisSebebi === "dolu") return _t("Berabere — çizgi yok");
    return _t("Berabere!");
  }
  if (!cpuyaKarsi) return durum.kazanan === X ? _t("1. Oyuncu kazandı!") : _t("2. Oyuncu kazandı!");
  return durum.kazanan === X ? _t("Kazandın!") : _t("CPU kazandı");
}
