// ============================================================================
// ONLINE "ORTAK KULÜP — TAKIMI SEN SEÇ" — SAF OYUN MANTIĞI
//
// Paket 42 (26 Ekim 2026) — Kerem: "takımı sen seç modu salakça olmuş.
// istediğim şey iki taraf da aynı turda birer takım söyler, 3-2-1 sayacından
// sonra söylenen takımlar ekrana gelir ve erken doğru cevap yazan puanı alır."
//
// ESKİ (12 Eylül): sıra tabanlıydı — biri takım seçiyor, motor ikinci takımı
// buluyor, soruyu yalnız KARŞI taraf cevaplıyordu.
// YENİ — eş zamanlı:
//   1) SEÇİM: iki oyuncu da aynı anda, GİZLİCE birer takım seçer (rakibinkini
//      görmezsin; yalnız "seçti" bilgisi gelir).
//   2) GERİ SAYIM: iki seçim de gelince 3-2-1 (GERI_SAYIM_MS).
//   3) AÇILIŞ: iki takım ekrana gelir. Ortak futbolcuları ASGARI_GECERLI_CEVAP'tan
//      azsa (ya da aynı takım seçildiyse) tur geçersiz: takımlar gösterilir,
//      kısa bir mesajdan sonra yeniden seçilir (puan yok).
//   4) YARIŞ: ikisi de aynı anda yazar; İLK DOĞRU yazan puanı alır. Turda 3
//      yanlış hakkı; bitince (ya da "Bilemedim") o turda elenirsin. İkiniz de
//      elenir ya da süre dolarsa tur kimseye yazılmaz.
//   HEDEF_PUAN'a ilk ulaşan maçı alır.
// Ağ katmanı lib/onlineRoom.js (host her aksiyonu bu indirgeyiciden geçirir);
// zaman damgaları host saatinden. Bu dosya saf, Node'da test ediliyor.
// ============================================================================
import { playersForPair, findMatchedPlayer, buildClubSuggestIndex, rezervTakimMi } from "./gameEngine";
import { canonicalClub } from "./clubAliases";

export const GERI_SAYIM_MS = 3600;      // 3-2-1 (+ kısa pay)
export const CEVAP_SURESI_MS = 30000;   // yarış süresi
export const TUR_ARASI_MS = 5000;       // sonuç ekranının süresi
export const GECERSIZ_MS = 3500;        // "ortak futbolcu yok" mesajının süresi
export const HEDEF_PUAN = 5;            // maçı kazanmak için gereken puan
export const ASGARI_KULUP_OYUNCU = 15;  // seçilebilir kulüp için asgari oyuncu
export const ASGARI_GECERLI_CEVAP = 2;  // tur sayılsın diye asgari ortak futbolcu
export const YANLIS_HAKKI = 3;

const anahtar = (n) => `p${n}`;
export function rakip(n) {
  return n === 1 ? 2 : 1;
}

// Öneri indeksi: sadece yeterince kalabalık kulüpler.
export function secilebilirKulupIndeksi(kuluplerListesi, veriSeti) {
  return buildClubSuggestIndex(kuluplerListesi, veriSeti)
    .filter((k) => k.oyuncu >= ASGARI_KULUP_OYUNCU);
}

export function baslangicDurumu() {
  return {
    faz: "secim",            // secim | geriSayim | gecersiz | yaris | turSonu | macSonu
    turNo: 1,
    secimler: { p1: null, p2: null },
    teamA: null,             // 1. oyuncunun takımı
    teamB: null,             // 2. oyuncunun takımı
    gecerliCevaplar: [],     // [{ name }]
    acilis: 0,               // geri sayım bitişi (host ms)
    cevapBitis: 0,
    yanlislar: { p1: 0, p2: 0 },
    elenen: [],              // bu turda elenen oyuncular
    turKazanani: null,       // 1 | 2 | 0
    sonCevap: null,          // { kimden, metin, dogru, ad }
    gecersizSebep: null,     // "ayni" | "az"
    skorlar: { p1: 0, p2: 0 },
    kullanilanCiftler: [],
  };
}

function turuSifirla(durum, ek = {}) {
  return {
    ...durum,
    faz: "secim",
    secimler: { p1: null, p2: null },
    teamA: null,
    teamB: null,
    gecerliCevaplar: [],
    acilis: 0,
    cevapBitis: 0,
    yanlislar: { p1: 0, p2: 0 },
    elenen: [],
    turKazanani: null,
    sonCevap: null,
    gecersizSebep: null,
    ...ek,
  };
}

// Host'un çalıştırdığı indirgeyici. baglam: { veriSeti, izinliKulupler, simdi }
export function aksiyonuIsle(durum, aksiyon, kimden, baglam = {}) {
  if (!durum || !aksiyon) return null;
  const { veriSeti, izinliKulupler } = baglam;
  const simdi = baglam.simdi ? baglam.simdi() : Date.now();

  switch (aksiyon.tip) {
    case "kulupSec": {
      if (durum.faz !== "secim" || (kimden !== 1 && kimden !== 2)) return null;
      const kulup = String(aksiyon.kulup || "").trim();
      if (!kulup || rezervTakimMi(kulup)) return null;
      if (izinliKulupler && !izinliKulupler.has(kulup) && !izinliKulupler.has(canonicalClub(kulup))) {
        return { ...durum, secimReddi: { kimden, kulup, sayac: ((durum.secimReddi && durum.secimReddi.sayac) || 0) + 1 } };
      }
      const secimler = { ...durum.secimler, [anahtar(kimden)]: kulup };
      if (!secimler.p1 || !secimler.p2) return { ...durum, secimler };
      // İkisi de seçti → 3-2-1
      return { ...durum, secimler, faz: "geriSayim", acilis: simdi + GERI_SAYIM_MS };
    }

    // Seçimi değiştir (geri sayım başlamadan).
    case "secimiGeriAl": {
      if (durum.faz !== "secim") return null;
      return { ...durum, secimler: { ...durum.secimler, [anahtar(kimden)]: null } };
    }

    // Host: geri sayım bitti → takımlar açılır.
    case "ac": {
      if (durum.faz !== "geriSayim" || kimden !== 1) return null;
      const a = durum.secimler.p1, b = durum.secimler.p2;
      const ayni = (canonicalClub(a) || a) === (canonicalClub(b) || b);
      const cevaplar = ayni ? [] : playersForPair(veriSeti || [], a, b);
      const ek = { teamA: a, teamB: b, gecerliCevaplar: cevaplar.map((p) => ({ name: p.name })) };
      if (ayni || cevaplar.length < ASGARI_GECERLI_CEVAP) {
        return { ...durum, ...ek, faz: "gecersiz", gecersizSebep: ayni ? "ayni" : "az", cevapBitis: simdi + GECERSIZ_MS };
      }
      return { ...durum, ...ek, faz: "yaris", cevapBitis: simdi + CEVAP_SURESI_MS, yanlislar: { p1: 0, p2: 0 }, elenen: [] };
    }

    // Host: geçersiz tur → aynı tur yeniden seçilir.
    case "yenidenSec": {
      if (durum.faz !== "gecersiz" || kimden !== 1) return null;
      return turuSifirla(durum);
    }

    case "cevap": {
      if (durum.faz !== "yaris" || (kimden !== 1 && kimden !== 2)) return null;
      if (durum.elenen.includes(kimden)) return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;
      const eslesen = findMatchedPlayer(metin, durum.gecerliCevaplar);
      if (eslesen) return turuKapat(durum, kimden, { kimden, metin, dogru: true, ad: eslesen.name });
      const k = anahtar(kimden);
      const yanlislar = { ...durum.yanlislar, [k]: (durum.yanlislar[k] || 0) + 1 };
      const elenen = yanlislar[k] >= YANLIS_HAKKI ? [...durum.elenen, kimden] : durum.elenen;
      const yeni = { ...durum, yanlislar, elenen, sonCevap: { kimden, metin, dogru: false } };
      if (elenen.length >= 2) return turuKapat(yeni, 0, yeni.sonCevap);
      return yeni;
    }

    // "Bilemedim": bu turda elen.
    case "pes": {
      if (durum.faz !== "yaris" || durum.elenen.includes(kimden)) return null;
      const elenen = [...durum.elenen, kimden];
      if (elenen.length >= 2) return turuKapat({ ...durum, elenen }, 0, null);
      return { ...durum, elenen, sonCevap: { kimden, pes: true } };
    }

    // Host: süre doldu.
    case "sureDoldu": {
      if (durum.faz !== "yaris" || kimden !== 1) return null;
      if (simdi < durum.cevapBitis) return null;
      return turuKapat(durum, 0, null);
    }

    case "sonrakiTur": {
      if (durum.faz !== "turSonu" || kimden !== 1) return null;
      const kullanilanCiftler = durum.teamA && durum.teamB
        ? [...durum.kullanilanCiftler, [durum.teamA, durum.teamB].sort().join("|")]
        : durum.kullanilanCiftler;
      return turuSifirla(durum, { turNo: durum.turNo + 1, kullanilanCiftler });
    }

    case "rovans": {
      if (durum.faz !== "macSonu") return null;
      return baslangicDurumu();
    }

    default:
      return null;
  }
}

function turuKapat(durum, kazanan, sonCevap) {
  const skorlar = { ...durum.skorlar };
  if (kazanan) skorlar[anahtar(kazanan)] += 1;
  const bitti = kazanan && skorlar[anahtar(kazanan)] >= HEDEF_PUAN;
  return {
    ...durum,
    faz: bitti ? "macSonu" : "turSonu",
    skorlar,
    turKazanani: kazanan,
    sonCevap,
  };
}

// Sonuç ekranında gösterilecek örnek cevaplar (en fazla `adet` tane).
export function ornekCevaplar(durum, adet = 6) {
  return (durum.gecerliCevaplar || []).slice(0, adet).map((p) => p.name);
}
