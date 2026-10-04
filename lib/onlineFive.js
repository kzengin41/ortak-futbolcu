// ============================================================================
// ONLINE 5 KULÜP — kurallar (Paket 16, 5 Ekim 2026; Kerem: "5 kulüp online
// versiyonu yapalım")
//
// Tek telefonda 5 Kulüp'te oyuncular sırayla (zille) cevaplıyor. Online'da
// sıra beklemek yerine İKİ OYUNCU AYNI ANDA ve GİZLİ cevaplıyor:
//   • Her tur 5 kulüp (offline ile aynı üretici: generateFiveClubRound).
//   • Herkes süre içinde TEK futbolcu söyler; cevap verilince kilitlenir.
//     Futbolcu 5 kulübün kaçında oynadıysa o kadar puan (en az 2, yoksa 0).
//   • Veri setinde olmayan isim cevap sayılmaz (tekrar yazabilirsin).
//   • İkisi de cevaplayınca ya da süre bitince cevaplar AÇILIR.
//   • 3 tur (altın tur ×2 online'da yok — iki taraf da aynı anda oynuyor).
//   • Toplam puanı yüksek olan kazanır; eşitse berabere.
// Ağ: lib/onlineRoom.js (host durumu tutar). SAF dosya — veri işleri baglam ile:
//   baglam = { turUret(kullanilanKeyler, sonKulupler) -> {clubs, key} | null,
//              oyuncuBul(metin) -> { name } | null,
//              puanla(oyuncu, kulupler) -> { count, matchedClubs } }
// ============================================================================
export const TUR_SAYISI = 3;
export const TUR_SURESI_SN = 40;
export const ASGARI_ORTAK = 2;
export const SONUC_SURESI_MS = 6000;

const pk = (n) => `p${n}`;

export function baslangicDurumu(macNo = 0, kullanilan = []) {
  return {
    faz: "hazirlik",            // hazirlik | tur | turSonu | macSonu | hata
    macNo,
    turNo: 0,
    toplamTur: TUR_SAYISI,
    kulupler: [],
    key: null,
    kullanilan,                 // rövanşta da aynı 5'li tekrar gelmesin
    sonKulupler: [],
    cevaplar: { p1: null, p2: null },   // { ad, puan, kulupler } — puan 0 = geçersiz (2'den az kulüp)
    gecmis: [],                 // [{ kulupler, p1, p2 }] maç sonu özeti
    skorlar: { p1: 0, p2: 0 },
    sonOlay: null,
    rovansIstek: [],
  };
}

function yeniTur(durum, baglam) {
  const t = baglam && baglam.turUret ? baglam.turUret(durum.kullanilan || [], durum.sonKulupler || []) : null;
  if (!t) return { ...durum, faz: "hata" };
  return {
    ...durum,
    faz: "tur",
    turNo: (durum.turNo || 0) + 1,
    kulupler: t.clubs,
    key: t.key,
    kullanilan: [...(durum.kullanilan || []), t.key],
    sonKulupler: [...t.clubs, ...(durum.kulupler || [])].slice(0, 10),
    cevaplar: { p1: null, p2: null },
    sonOlay: null,
  };
}

function turuKapat(durum) {
  const p1 = durum.cevaplar.p1 ? durum.cevaplar.p1.puan : 0;
  const p2 = durum.cevaplar.p2 ? durum.cevaplar.p2.puan : 0;
  const skorlar = { p1: durum.skorlar.p1 + p1, p2: durum.skorlar.p2 + p2 };
  const gecmis = [...durum.gecmis, { kulupler: durum.kulupler, p1: durum.cevaplar.p1, p2: durum.cevaplar.p2 }];
  return { ...durum, skorlar, gecmis, faz: durum.turNo >= durum.toplamTur ? "macSonu" : "turSonu" };
}

export function aksiyonuIsle(durum, aksiyon, kimden, baglam = {}) {
  if (!durum || !aksiyon) return null;
  switch (aksiyon.tip) {
    case "baslat":
      if (durum.faz !== "hazirlik" || kimden !== 1) return null;
      return yeniTur({ ...durum, macNo: (durum.macNo || 0) + 1 }, baglam);

    case "sonrakiTur":
      if (durum.faz !== "turSonu" || kimden !== 1) return null;
      return yeniTur(durum, baglam);

    case "cevap": {
      if (durum.faz !== "tur" || (kimden !== 1 && kimden !== 2)) return null;
      if (durum.cevaplar[pk(kimden)]) return null;            // cevap kilitli
      const metin = String(aksiyon.metin || "").trim();
      if (!metin) return null;
      const o = baglam.oyuncuBul(metin);
      if (!o) return { ...durum, sonOlay: { tip: "bilinmeyen", kimden, metin, n: (durum.sonOlay?.n || 0) + 1 } };
      const s = baglam.puanla(o, durum.kulupler);
      const puan = s.count >= ASGARI_ORTAK ? s.count : 0;
      const cevaplar = { ...durum.cevaplar, [pk(kimden)]: { ad: o.name, puan, kulupler: s.matchedClubs } };
      const sonraki = { ...durum, cevaplar, sonOlay: { tip: "cevap", kimden, n: (durum.sonOlay?.n || 0) + 1 } };
      return cevaplar.p1 && cevaplar.p2 ? turuKapat(sonraki) : sonraki;
    }

    // Süre: yalnız host, yalnız o tur için (eski zamanlayıcı yeni turu kapatmasın)
    case "sureDoldu":
      if (kimden !== 1 || durum.faz !== "tur" || aksiyon.turNo !== durum.turNo) return null;
      return turuKapat(durum);

    case "rovans":
      // Yalnızca iki taraf da istediğinde çağrılır (bkz. onlineRoom.rovansli).
      if (durum.faz !== "macSonu") return null;
      return baslangicDurumu(durum.macNo || 0, durum.kullanilan || []);

    default:
      return null;
  }
}

export function sonuc(durum, benKimim) {
  const ben = durum.skorlar[pk(benKimim)], rk = durum.skorlar[pk(benKimim === 1 ? 2 : 1)];
  return ben > rk ? "sen" : ben < rk ? "rakip" : "berabere";
}
