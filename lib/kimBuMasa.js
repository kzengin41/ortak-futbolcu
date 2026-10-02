// ============================================================================
// KİM BU FUTBOLCU? — KART MASASI KURALLARI (3 Ekim 2026)
//
// Kerem'in onayladığı kurgu (benchmark dokümanı, "Kim Bu — baştan yeni kurgu"):
//   • Gizli futbolcunun bilgileri yüzü kapalı kartlarda: KİMLİK (bayrak, mevki,
//     doğum yılı, boy — 500'er), KARİYER (kulüpler zaman sırasıyla, yıllar açık,
//     ad kapalı — 1.000'er, son/güncel kulüp 2.000), VİTRİN (başarılar 1.500,
//     ünlü takım arkadaşı 1.500, silüet 2.500).
//   • Tur bir kart açık başlar; en çok ele veren kartlar (son kulüp, silüet)
//     hiçbir zaman başta açılmaz.
//   • "Şimdi bilirsen" = 10.000 − çevrilen kartların bedeli (en az 1.000).
//     Hiç kart çevirmeden bilirsen ×2, 1–2 kartla ×1,5.
//   • Yanlış tahmin −1 can ve bir KARŞILAŞTIRMA satırı bırakır (bayrak, mevki,
//     yaş, lig, ortak kulüp). Ortak kulüp varsa o kulübün kariyer kartı BEDAVA
//     açılır. Doğru tahmin +1 can (en fazla 3).
//
// Bu dosya SAF: React yok, ekran yok. Veriyi dışarıdan alır, Node'da test edilir.
// ============================================================================
import { canonicalClub } from "./clubAliases";
import { rezervTakimMi } from "./gameEngine";
import { countryTr } from "./countryNamesTr";
import { positionTr } from "./positionNamesTr";
import { BASARILAR } from "./basarilar";

export const BASLANGIC_PUANI = 10000;
export const ASGARI_PUAN = 1000;
export const AZAMI_CAN = 3;
export const BEDEL = {
  bayrak: 500, mevki: 500, dogum: 500, boy: 500,
  kulup: 1000, sonKulup: 2000,
  basarilar: 1500, arkadas: 1500, siluet: 2500,
};

const BU_YIL = new Date().getFullYear();

// "Centre-back" -> "DF". Kaba ama karşılaştırma için yeterli dört kategori.
export function mevkiKategorisi(pos) {
  const p = String(pos || "").toLowerCase();
  if (!p) return null;
  if (/goal ?keeper|kaleci/.test(p)) return "KL";
  if (/forward|striker|winger|outside|attacker|forvet|kanat/.test(p)) return "FV";
  if (/midfield|half|playmaker|orta saha|libero/.test(p)) return "OS";
  if (/back|defender|sweeper|defans|stoper|bek/.test(p)) return "DF";
  return null;
}
const KATEGORI_AD = { KL: "Kaleci", DF: "Defans", OS: "Orta saha", FV: "Forvet" };

// ---------------------------------------------------------------- kariyer
// playerProfiles "k": [kulüp sıra no (players.json clubs indeksi), başlangıç, bitiş, maç, gol]
// Aynı kulübe art arda dönüşler tek kart; rezerv/altyapı takımları kart olmaz.
export function kariyerKartlari(oyuncu, profil) {
  // Omurga players.json'daki kulüp sırası (kronolojik); yıllar profilin "k"
  // satırlarından eklenir. Wikidata kariyeri çoğu zaman yarım (Behich'in PSV,
  // Başakşehir... dönemleri yok), o yüzden sadece "k"ya dayanmak kulüp kaybettiriyordu.
  const kulupler = oyuncu.clubs || [];
  const yillar = new Map(); // indeks -> { bas, bit }
  if (profil && Array.isArray(profil.k)) {
    for (const [i, bas, bit] of profil.k) {
      if (!Number.isFinite(bas)) continue;
      // Kulübe birden çok dönem (Quaresma - Porto, Beşiktaş): İLK dönem yazılır,
      // sonuna "+" eklenir ("2004–08+" = sonra tekrar döndü).
      const y = yillar.get(i);
      const b2 = Number.isFinite(bit) ? bit : null;
      if (!y) yillar.set(i, { bas, bit: b2, donus: false });
      else if (bas < y.bas) yillar.set(i, { bas, bit: b2, donus: true });
      else y.donus = true;
    }
  }
  let satirlar = kulupler
    .map((kulup, i) => ({ kulup, bas: yillar.get(i)?.bas ?? null, bit: yillar.get(i)?.bit ?? null, donus: !!yillar.get(i)?.donus }))
    .filter((s) => !rezervTakimMi(s.kulup));
  // Hepsinin yılı biliniyorsa yıla göre sırala (kiralıklar araya doğru girsin).
  if (satirlar.length && satirlar.every((s) => s.bas != null)) satirlar.sort((a, b) => a.bas - b.bas);
  // Art arda aynı kulüp -> birleştir
  const birlesik = [];
  for (const s of satirlar) {
    const son = birlesik[birlesik.length - 1];
    if (son && canonicalClub(son.kulup) === canonicalClub(s.kulup)) continue;
    birlesik.push({ ...s });
  }
  return birlesik.slice(-10).map((s, idx, dizi) => ({
    id: `kulup${idx}`,
    tur: "kulup",
    kulup: s.kulup,
    yil: yilYazisi(s.bas, s.bit, idx === dizi.length - 1) + (s.donus ? "+" : ""),
    bedel: idx === dizi.length - 1 ? BEDEL.sonKulup : BEDEL.kulup,
    son: idx === dizi.length - 1,
  }));
}

function yilYazisi(bas, bit, son) {
  if (bas == null) return "?";
  const k = (y) => String(y);
  if (bit == null) return son ? `${k(bas)}–` : k(bas);
  if (bit === bas) return k(bas);
  return `${k(bas)}–${String(bit).slice(-2)}`;
}

// ---------------------------------------------------------------- takım arkadaşı
// Kulüp -> [ad, başlangıç, bitiş] dizini. İlk ihtiyaçta bir kez kurulur.
let _kulupDizini = null;
function kulupDizini(oyuncular, profiller) {
  if (_kulupDizini) return _kulupDizini;
  _kulupDizini = new Map();
  for (const o of oyuncular) {
    const pr = profiller[o.name];
    if (!pr || !Array.isArray(pr.k)) continue;
    for (const [i, bas, bit] of pr.k) {
      const ad = o.clubs[i];
      if (!ad || !Number.isFinite(bas)) continue;
      const anahtar = canonicalClub(ad);
      if (!_kulupDizini.has(anahtar)) _kulupDizini.set(anahtar, []);
      _kulupDizini.get(anahtar).push([o.name, bas, Number.isFinite(bit) ? bit : BU_YIL]);
    }
  }
  return _kulupDizini;
}

// Aynı kulüpte AYNI YILLARDA oynamış en tanınmış oyuncu. Yıl verisi yoksa null.
export function unluTakimArkadasi(gizli, profil, oyuncular, profiller, tanin) {
  if (!profil || !Array.isArray(profil.k)) return null;
  const dizin = kulupDizini(oyuncular, profiller);
  let enIyi = null;
  for (const [i, bas, bit] of profil.k) {
    const ad = gizli.clubs[i];
    if (!ad || !Number.isFinite(bas) || rezervTakimMi(ad)) continue;
    const son = Number.isFinite(bit) ? bit : BU_YIL;
    for (const [diger, b2, e2] of dizin.get(canonicalClub(ad)) || []) {
      if (diger === gizli.name) continue;
      if (b2 > son || e2 < bas) continue;
      const t = (tanin[diger] && tanin[diger][1]) || 0;
      if (!enIyi || t > enIyi.t) enIyi = { ad: diger, kulup: ad, t };
    }
  }
  return enIyi && enIyi.t >= 90 ? { ad: enIyi.ad, kulup: enIyi.kulup } : null;
}

// ---------------------------------------------------------------- masa
// veri: { profil, dogumMevki, milliler, basarilar (kod listesi), basariSayilari,
//         arkadas, fotoVar }
export function masaKur(oyuncu, veri, rastgele = Math.random) {
  const bp = veri.dogumMevki || {};
  const ulke = (veri.milliler || [])[0];
  const kimlik = [];
  if (ulke) kimlik.push({ id: "bayrak", tur: "kimlik", etiket: "BAYRAK", deger: countryTr(ulke), bedel: BEDEL.bayrak });
  const kat = mevkiKategorisi(bp.position);
  if (bp.position) kimlik.push({ id: "mevki", tur: "kimlik", etiket: "MEVKİ", deger: positionTr(bp.position).split(",")[0] || KATEGORI_AD[kat] || "?", bedel: BEDEL.mevki });
  if (bp.birthYear) kimlik.push({ id: "dogum", tur: "kimlik", etiket: "DOĞUM", deger: String(bp.birthYear), bedel: BEDEL.dogum });
  if (veri.profil && veri.profil.b) kimlik.push({ id: "boy", tur: "kimlik", etiket: "BOY", deger: `${veri.profil.b} cm`, bedel: BEDEL.boy });

  const kariyer = kariyerKartlari(oyuncu, veri.profil);

  const vitrin = [];
  if (veri.basarilar && veri.basarilar.length) {
    const sayi = veri.basariSayilari || {};
    vitrin.push({
      id: "basarilar", tur: "vitrin", etiket: "Başarılar", bedel: BEDEL.basarilar,
      liste: veri.basarilar.slice(0, 5).map((k) => (BASARILAR[k] ? BASARILAR[k].etiket : k) + (sayi[k] > 1 ? ` ×${sayi[k]}` : "")),
    });
  }
  if (veri.arkadas) vitrin.push({ id: "arkadas", tur: "vitrin", etiket: "Takım arkadaşı", bedel: BEDEL.arkadas, deger: veri.arkadas.ad, alt: veri.arkadas.kulup });
  if (veri.fotoVar) vitrin.push({ id: "siluet", tur: "vitrin", etiket: "Silüet", bedel: BEDEL.siluet });

  // Başta açık kart: önce mevki/bayrak/doğum, yoksa son olmayan bir kulüp.
  const adaylar = [...kimlik.filter((k) => k.id !== "boy"), ...kariyer.filter((k) => !k.son)];
  const ilk = adaylar.length ? adaylar[Math.floor(rastgele() * adaylar.length)] : null;

  return { kimlik, kariyer, vitrin, acik: ilk ? { [ilk.id]: "baslangic" } : {} };
}

export function tumKartlar(masa) {
  return [...masa.kimlik, ...masa.kariyer, ...masa.vitrin];
}

// acik: { kartId: "baslangic" | "satin" | "bedava" }
export function simdiBilirsen(masa, acik) {
  let p = BASLANGIC_PUANI;
  for (const k of tumKartlar(masa)) if (acik[k.id] === "satin") p -= k.bedel;
  return Math.max(ASGARI_PUAN, p);
}

export function satinAlinanSayisi(acik) {
  return Object.values(acik).filter((v) => v === "satin").length;
}

export function carpan(acik) {
  const n = satinAlinanSayisi(acik);
  if (n === 0) return 2;
  if (n <= 2) return 1.5;
  return 1;
}

export function turPuani(masa, acik) {
  return Math.round(simdiBilirsen(masa, acik) * carpan(acik));
}

// ---------------------------------------------------------------- karşılaştırma
// Her hücre: "evet" | "hayir" | "yukari" (gizli oyuncu daha yaşlı) | "asagi" | "esit" | "yok"
export function karsilastir(tahmin, gizli, veriT, veriG, kulupUlkesi) {
  const ulkeT = new Set(veriT.milliler || []);
  const ulkeG = veriG.milliler || [];
  const bayrak = !ulkeG.length || !ulkeT.size ? "yok" : ulkeG.some((u) => ulkeT.has(u)) ? "evet" : "hayir";

  const mT = mevkiKategorisi((veriT.dogumMevki || {}).position);
  const mG = mevkiKategorisi((veriG.dogumMevki || {}).position);
  const mevki = !mT || !mG ? "yok" : mT === mG ? "evet" : "hayir";

  const yT = (veriT.dogumMevki || {}).birthYear;
  const yG = (veriG.dogumMevki || {}).birthYear;
  // Gizli oyuncu tahminden DAHA GENÇ ise "asagi" (yaş ↓), daha yaşlıysa "yukari".
  const yas = !yT || !yG ? "yok" : yG === yT ? "esit" : yG > yT ? "asagi" : "yukari";

  const sonUlke = (o, pr) => {
    const k = (pr && (pr.g || pr.s)) || (o.clubs || [])[o.clubs.length - 1];
    return k ? kulupUlkesi[k] || null : null;
  };
  const lT = sonUlke(tahmin, veriT.profil);
  const lG = sonUlke(gizli, veriG.profil);
  const lig = !lT || !lG ? "yok" : lT === lG ? "evet" : "hayir";

  const kanonG = new Map((gizli.clubs || []).filter((c) => !rezervTakimMi(c)).map((c) => [canonicalClub(c), c]));
  const ortak = [];
  for (const c of tahmin.clubs || []) {
    const k = canonicalClub(c);
    if (kanonG.has(k) && !ortak.includes(kanonG.get(k))) ortak.push(kanonG.get(k));
  }
  return { ad: tahmin.name, bayrak, mevki, yas, lig, kulup: ortak.length ? "evet" : "hayir", ortakKulupler: ortak };
}

// Ortak kulüplerin kariyer kartlarını bedava aç. Yeni açılan kart id'lerini döndürür.
export function ortakKartlariAc(masa, acik, ortakKulupler) {
  const yeni = [];
  const hedef = new Set(ortakKulupler.map(canonicalClub));
  for (const k of masa.kariyer) {
    if (acik[k.id]) continue;
    if (hedef.has(canonicalClub(k.kulup))) yeni.push(k.id);
  }
  return yeni;
}

export function yeniCan(can, dogru) {
  return dogru ? Math.min(AZAMI_CAN, can + 1) : can - 1;
}
