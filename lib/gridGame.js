// ============================================================================
// FUTBOLCU XOX (3x3 IZGARA) — 12 Eylül 2026, Kerem'in isteği
//   "xox oyunu da eklemek istiyorum. hem vs cpu hem aynı ekranda arkadaşla
//    oynama şekli."
//
// Düz tic-tac-toe yerine futbol bilgisiyle oynanan XOX: ızgaranın 3 SATIRINDA
// ve 3 SÜTUNUNDA birer kulüp var. Bir kareyi almak için o karenin satır ve
// sütun kulüplerinin İKİSİNDE DE oynamış bir futbolcu söylemek gerekiyor.
// Bilirsen kare senin olur, bilemezsen sıra rakibe geçer. Üçlü sırayı yapan
// kazanır; tahta dolarsa çok kare alan kazanır.
//
// Kurallar burada SAF fonksiyonlar olarak duruyor: React yok, Supabase yok.
// Hem CPU hem "aynı telefonda 2 kişi" modu bu tek dosyayı kullanıyor, yani
// kural farkı olması imkansız.
// ============================================================================
import { playersForPair, findMatchedPlayer, rezervTakimMi, FIVE_CLUB_POOL } from "./gameEngine";
import { canonicalClub } from "./clubAliases";
import { recognitionScore, MEGA, BIG, CHAMPIONS_LEAGUE_CLUBS, WELL_KNOWN_EXTRA } from "./clubWeights";

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
  { id: 1, etiket: "Çok Kolay", aciklama: "Bol ortak isimli dev kulüpler", kademe: 5, asgari: 35, azami: null, un: 0.55, bilgi: 0.35, taktik: 0.10, dilim: 50 },
  { id: 2, etiket: "Kolay",     aciklama: "Tanıdık kulüpler, rahat kareler", kademe: 5, asgari: 20, azami: null, un: 0.40, bilgi: 0.50, taktik: 0.30, dilim: 35 },
  { id: 3, etiket: "Orta",      aciklama: "Dengeli",                        kademe: 5, asgari: 10, azami: null, un: 0.20, bilgi: 0.68, taktik: 0.60, dilim: 20 },
  { id: 4, etiket: "Zor",       aciklama: "Az ortak isimli kareler",        kademe: 5, asgari: 4,  azami: 14,   un: 0.05, bilgi: 0.85, taktik: 0.85, dilim: 10 },
  { id: 5, etiket: "Çok Zor",   aciklama: "İğne deliği kareler",            kademe: 5, asgari: 3,  azami: 7,    un: 0,    bilgi: 0.95, taktik: 1.00, dilim: 6  },
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
function unlulereEgilimliSirala(havuz, unAgirligi, rastgele) {
  if (!unAgirligi) return karistir(havuz, rastgele);
  return [...havuz]
    .map((c) => ({ c, anahtar: rastgele() - unAgirligi * (unPuani(c) / 3) }))
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

export function izgaraUret(veriSeti, seviye = VARSAYILAN_ZORLUK, rastgele = Math.random) {
  const sayac = ikiliSayaclari(veriSeti);
  const ayar = zorlukAyari(seviye);
  const kademe = seviyeHavuzu(seviye);

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
  return playersForPair(veriSeti, izgara.satirlar[satir], izgara.sutunlar[sutun]);
}

// --- Oyun durumu ------------------------------------------------------------
// PERFORMANS: dokuz karenin geçerli cevapları BURADA, bir kez hesaplanıyor.
// Başta her kontrolde playersForPair çağrılıyordu (46 bin oyuncu taraması);
// "bu karede kullanılmamış cevap kaldı mı" kontrolü her hamlede dokuz kez
// çalıştığı için maç simülasyonu dakikalarca sürdü. Bir ızgaranın cevapları
// değişmez, o yüzden tek seferlik.
export function baslangicDurumu(izgara, ilkOynayan = X, veriSeti = null) {
  const hucreAdlari = veriSeti
    ? Array.from({ length: 9 }, (_, i) =>
        hucreCevaplari(veriSeti, izgara, Math.floor(i / 3), i % 3).map((p) => p.name))
    : null;
  return {
    izgara,
    hucreAdlari,
    tahta: [null, null, null, null, null, null, null, null, null], // "x" | "o" | null
    sira: ilkOynayan,
    secili: null,          // { satir, sutun } — cevap bekleyen hücre
    kullanilanlar: [],     // hamle kaydi (kural degil) — ekranda gosteriliyor
    hucreSahipleri: {},    // "0-2" -> { oyuncu: "x", ad: "Deco" }
    sonHamle: null,        // { tip, kimden, metin, ad }
    hamleNo: 0,            // her tamamlanan hamlede (cevap/pas/süre) artar — sayaç sıfırlama için
    bitti: false,
    kazanan: null,         // "x" | "o" | "berabere"
    kazananCizgi: null,    // [i, j, k]
  };
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

// 25 Eylul 2026 (Kerem: "xox'te ayni futbolcu kullanilabilir, kisitlama yok"
// -> kisitlamanin KALKMASINI istedi) — "bir futbolcu macta bir kez" kurali
// KALDIRILDI. Ayni futbolcu istenildigi kadar kullanilabilir.
// Bunun iki yan etkisi vardi, ikisi de burada karsilandi:
//   1) Bir kare artik ASLA "tukenemez" (cevabi varsa hep alinabilir), yani
//      eski kilitlenme (deadlock) senaryosu ortadan kalkti — kareTukendiMi
//      artik yalnizca "hic cevabi olmayan kare" durumunu koruyor.
//   2) CPU kendini tekrar edip aptal gorunmesin diye kullanilmamis isimleri
//      TERCIH ediyor, ama zorunlu degil (bkz. cpuCevapSec).
// durum.kullanilanlar artik bir KURAL degil, ekranda gosterilen hamle kaydi.
//
// Bir karenin HIC gecerli cevabi yok mu? (Izgara uretimi her kareye en az
// ASGARI_HUCRE_CEVAP cevap garantiliyor, yani normalde hep false doner —
// veriSeti gelmediginde ya da beklenmedik bir izgarada guvenlik agi olarak
// duruyor. Eskiden burada "kullanilmamis cevap kaldi mi" bakiliyordu; kural
// kalktigi icin artik gerek yok.)
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

// Tahta dolduysa: çok kare alan kazanır (3'lü sıra yoksa bile bir kazanan
// çıksın — düz XOX'taki "berabere" burada sıkıcı olurdu, çünkü kareyi almak
// zaten bir başarı).
function bitisiHesapla(tahta, durum, veriSeti) {
  const k = kazananBul(tahta);
  if (k) return { bitti: true, kazanan: k.kazanan, kazananCizgi: k.cizgi };
  // Tahta dolmadan da kilitlenebilir: kalan karelerin hiçbirinde kullanılmamış
  // geçerli cevap yoksa oyun bitmiş demektir.
  const kilitli = durum && (durum.hucreAdlari || veriSeti) && !oynanabilirKareVar({ ...durum, tahta }, veriSeti);
  if (bosHucreler(tahta).length === 0 || kilitli) {
    const x = tahta.filter((v) => v === X).length;
    const o = tahta.filter((v) => v === O).length;
    return { bitti: true, kazanan: x === o ? "berabere" : x > o ? X : O, kazananCizgi: null };
  }
  return { bitti: false, kazanan: null, kazananCizgi: null };
}

// Aksiyonlar: hücre seç, cevap ver, pas geç.
export function aksiyonuIsle(durum, aksiyon, baglam) {
  if (!durum || durum.bitti || !aksiyon) return null;
  const { veriSeti } = baglam || {};

  switch (aksiyon.tip) {
    case "hucreSec": {
      const { satir, sutun } = aksiyon;
      const indis = satir * 3 + sutun;
      if (durum.tahta[indis]) return null;              // kare zaten alınmış
      return { ...durum, secili: { satir, sutun }, sonHamle: null };
    }

    case "secimiIptal":
      if (!durum.secili) return null;
      return { ...durum, secili: null };

    case "cevap": {
      if (!durum.secili) return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;

      const { satir, sutun } = durum.secili;
      const indis = satir * 3 + sutun;
      const adaylar = hucreCevaplari(veriSeti, durum.izgara, satir, sutun);
      const eslesen = findMatchedPlayer(metin, adaylar);

      if (!eslesen) {
        // Yanlış cevap: kare alınmaz, sıra rakibe geçer.
        return {
          ...durum,
          secili: null,
          sira: digeri(durum.sira),
          sonHamle: { tip: "yanlis", kimden: durum.sira, metin, ad: null },
          hamleNo: (durum.hamleNo || 0) + 1,
        };
      }

      const tahta = [...durum.tahta];
      tahta[indis] = durum.sira;
      const araDurum = { ...durum, kullanilanlar: [...durum.kullanilanlar, eslesen.name] };
      const bitis = bitisiHesapla(tahta, araDurum, veriSeti);
      return {
        ...durum,
        tahta,
        secili: null,
        kullanilanlar: [...durum.kullanilanlar, eslesen.name],
        hucreSahipleri: { ...durum.hucreSahipleri, [`${satir}-${sutun}`]: { oyuncu: durum.sira, ad: eslesen.name } },
        sira: bitis.bitti ? durum.sira : digeri(durum.sira),
        sonHamle: { tip: "dogru", kimden: durum.sira, metin, ad: eslesen.name },
        hamleNo: (durum.hamleNo || 0) + 1,
        ...bitis,
      };
    }

    case "pas": {
      if (!durum.secili) return null;
      return {
        ...durum,
        secili: null,
        sira: digeri(durum.sira),
        sonHamle: { tip: "pas", kimden: durum.sira, metin: null, ad: null },
        hamleNo: (durum.hamleNo || 0) + 1,
      };
    }

    // 26 Eylül 2026 (Kerem: "cevap başına süre sınırı") — süre dolunca sıra
    // rakibe geçer. "pas"tan farkı: kare SEÇİLMEMİŞ olsa da çalışır (oyuncu
    // kare seçmeden de süreyi doldurabilir).
    case "sureDoldu":
      return {
        ...durum,
        secili: null,
        sira: digeri(durum.sira),
        sonHamle: { tip: "sure", kimden: durum.sira, metin: null, ad: null },
        hamleNo: (durum.hamleNo || 0) + 1,
      };

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
  if (!bos.length) return null;
  const ayar = zorlukAyari(seviye);
  const ben = durum.sira;

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
  const taze = tumu.filter((p) => !kullanilan.has(p.name));
  const adaylar = taze.length ? taze : tumu;
  // (tanınırlığa göre sıralayabilmek için tam nesnelere ihtiyaç var, bu yüzden
  //  burada önbellek değil gerçek liste kullanılıyor — hamle başına bir kez)
  if (!adaylar.length) return null;

  const sirali = [...adaylar].sort((a, b) => recognitionScore(b) - recognitionScore(a));
  const ust = Math.max(1, Math.min(ayar.dilim, sirali.length));
  return sirali[Math.floor(rastgele() * ust)].name;
}

// Sonuç metni — ekranda tek yerden okunsun diye burada.
export function sonucMetni(durum, cpuyaKarsi) {
  if (!durum.bitti) return "";
  if (durum.kazanan === "berabere") return "Berabere!";
  if (!cpuyaKarsi) return durum.kazanan === X ? "1. Oyuncu kazandı!" : "2. Oyuncu kazandı!";
  return durum.kazanan === X ? "Kazandın!" : "CPU kazandı";
}
