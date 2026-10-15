// ============================================================================
// ONLINE "ORTAK KULÜP — KULÜP × ÜLKE" — SAF OYUN MANTIĞI (Paket 32, 15 Ekim 2026)
//
// Kerem: "3-2-1 içine girince online'da ülke-takım … modu yok?" — CPU'da olan
// Kulüp × Ülke online'da hiç yoktu. Kural CPU modunun aynısı:
//   Bir ülke ve bir kulüp çıkar. O ülkenin (vatandaşlık ya da milli takım)
//   o kulüpte oynamış bir futbolcusunu rakibinden ÖNCE yaz.
// İki oyuncu AYNI ANDA yazar (zil yok); ilk doğru yazan turu alır.
// Her oyuncunun turda YANLIS_HAKKI yanlış hakkı var; hakkı biten o turda
// susar. İkisinin de hakkı biterse ya da süre dolarsa tur kimsenin olmaz.
// HEDEF_PUAN'a ilk ulaşan maçı alır.
//
// Mimari lib/onlineDraft.js ile aynı: host durumun tek sahibi, bu dosya saf
// (test edilebilir) indirgeyici; ağ katmanı lib/onlineRoom.js.
// Tur üretimi CPU modundaki motorla (generateCountryTeamRound) — online'da
// zorluk sabit (tanıdık, dolu eşleşmeler) ve en az ASGARI_CEVAP geçerli cevap.
// ============================================================================
import { generateCountryTeamRound, findMatchedPlayer, rezervTakimMi } from "./gameEngine";

export const TUR_SURESI_MS = 25000;
export const TUR_ARASI_MS = 4500;
export const HEDEF_PUAN = 5;
export const YANLIS_HAKKI = 3;
export const ZORLUK = 4;
export const ASGARI_CEVAP = 2;
const URETIM_DENEMESI = 25;

export function turUret(havuz, veriSeti, kullanilan, izinliKulupler) {
  if (!havuz) return null;
  for (let i = 0; i < URETIM_DENEMESI; i++) {
    const g = generateCountryTeamRound(havuz, veriSeti, kullanilan, izinliKulupler, ZORLUK);
    if (!g) return null;
    if ((g.validAnswers || []).length < ASGARI_CEVAP) continue;
    if (rezervTakimMi(g.club)) continue;
    return g;
  }
  return null;
}

export function baslangicDurumu() {
  return {
    faz: "hazirlik",          // hazirlik | cevap | turSonu | macSonu | hata
    turNo: 0,
    ulke: null,
    kulup: null,
    gecerliCevaplar: [],      // [{ name, clubs }]
    bitis: 0,                 // epoch ms
    yanlis: { p1: 0, p2: 0 }, // bu turdaki yanlış sayıları
    sonYanlis: null,          // { kimden, metin, n } — ekran uyarısı için
    turKazanani: null,        // 1 | 2 | 0
    sonCevap: null,           // { ad } | null
    skorlar: { p1: 0, p2: 0 },
    kullanilanCiftler: [],
  };
}

function yeniTur(durum, baglam) {
  const { havuz, veriSeti, izinliKulupler } = baglam || {};
  const kullanilan = new Set(durum.kullanilanCiftler || []);
  const g = turUret(havuz, veriSeti, kullanilan, izinliKulupler);
  if (!g) return { ...durum, faz: "hata" };
  return {
    ...durum,
    faz: "cevap",
    turNo: (durum.turNo || 0) + 1,
    ulke: g.country,
    kulup: g.club,
    gecerliCevaplar: g.validAnswers.map((p) => ({ name: p.name, clubs: p.clubs })),
    bitis: Date.now() + TUR_SURESI_MS,
    yanlis: { p1: 0, p2: 0 },
    sonYanlis: null,
    turKazanani: null,
    sonCevap: null,
    kullanilanCiftler: [...(durum.kullanilanCiftler || []), g.key],
  };
}

function turuKapat(durum, kazanan, sonCevap) {
  if (!kazanan) return { ...durum, faz: "turSonu", turKazanani: 0, sonCevap: null };
  const k = `p${kazanan}`;
  const skorlar = { ...durum.skorlar, [k]: durum.skorlar[k] + 1 };
  return { ...durum, faz: skorlar[k] >= HEDEF_PUAN ? "macSonu" : "turSonu", skorlar, turKazanani: kazanan, sonCevap };
}

export function hakkiBittiMi(durum, kim) {
  return !!durum && (durum.yanlis?.[`p${kim}`] || 0) >= YANLIS_HAKKI;
}

// Host'un çalıştırdığı indirgeyici. baglam: { havuz, veriSeti, izinliKulupler }
export function aksiyonuIsle(durum, aksiyon, kimden, baglam) {
  if (!durum || !aksiyon) return null;
  switch (aksiyon.tip) {
    case "basla": {
      if (durum.faz !== "hazirlik" || kimden !== 1) return null;
      return yeniTur(durum, baglam);
    }
    case "cevap": {
      if (durum.faz !== "cevap" || (kimden !== 1 && kimden !== 2)) return null;
      if (hakkiBittiMi(durum, kimden)) return null;
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;
      const eslesen = findMatchedPlayer(metin, durum.gecerliCevaplar);
      if (eslesen) return turuKapat(durum, kimden, { ad: eslesen.name });
      const k = `p${kimden}`;
      const yanlis = { ...durum.yanlis, [k]: (durum.yanlis[k] || 0) + 1 };
      const sonraki = { ...durum, yanlis, sonYanlis: { kimden, metin, n: ((durum.sonYanlis && durum.sonYanlis.n) || 0) + 1 } };
      if (yanlis.p1 >= YANLIS_HAKKI && yanlis.p2 >= YANLIS_HAKKI) return turuKapat(sonraki, 0);
      return sonraki;
    }
    case "pes": {
      if (durum.faz !== "cevap" || (kimden !== 1 && kimden !== 2)) return null;
      const yanlis = { ...durum.yanlis, [`p${kimden}`]: YANLIS_HAKKI };
      const sonraki = { ...durum, yanlis };
      if (yanlis.p1 >= YANLIS_HAKKI && yanlis.p2 >= YANLIS_HAKKI) return turuKapat(sonraki, 0);
      return sonraki;
    }
    case "sureDoldu": {
      if (durum.faz !== "cevap") return null;
      return turuKapat(durum, 0);
    }
    case "sonrakiTur": {
      if (durum.faz !== "turSonu") return null;
      return yeniTur(durum, baglam);
    }
    case "rovans": {
      if (durum.faz !== "macSonu") return null;
      return yeniTur(baslangicDurumu(), baglam);
    }
    default:
      return null;
  }
}

export function ornekCevaplar(durum, adet = 6) {
  return (durum.gecerliCevaplar || []).slice(0, adet).map((p) => p.name);
}
