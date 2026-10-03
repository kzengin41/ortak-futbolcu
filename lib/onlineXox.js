// ============================================================================
// ONLINE FUTBOLCU XOX — kurallar (5 Ekim 2026, benchmark .29379)
//
// "Online XOX: mevcut online oda altyapısı (5 haneli kod) üzerine; sıra
// tabanlı olduğu için gerçek zamanlı senkron gerekmiyor."
//
// Izgara kuralları offline XOX ile BİREBİR aynı (lib/gridGame.js — çalma
// kuralı açık, oyuncu başı 3 hak). Bu dosya yalnızca online zarfı ekliyor:
//   • oyuncu 1 = X, oyuncu 2 = O; ilk hamle maç numarasına göre dönüşümlü
//   • bir aksiyonu YALNIZCA sırası gelen oyuncu yapabilir (host doğrular)
//   • hamle süresi host'ta işler; "sureDoldu" eski bir hamleye uygulanmasın
//     diye hamle numarasıyla gelir
// Ağ katmanı lib/onlineRoom.js; bu dosya saf, Node'da test ediliyor.
// ============================================================================
import { baslangicDurumu as izgaraBaslangic, aksiyonuIsle as izgaraAksiyonu, X, O } from "./gridGame";

export const HAMLE_SURESI_SN = 30;
export const ISARET = { 1: X, 2: O };
const IZINLI_HAMLELER = new Set(["hucreSec", "secimiIptal", "cevap", "pas"]);

export function oyuncuNo(isaret) {
  return isaret === X ? 1 : isaret === O ? 2 : 0;
}

export function baslangicDurumu(macNo = 0) {
  return { faz: "hazirlik", macNo, oyun: null, rovansIstek: [] };
}

function sonuclandir(durum, oyun) {
  return { ...durum, oyun, faz: oyun.bitti ? "macSonu" : "oynaniyor" };
}

// baglam: { veriSeti, izgaraYap: () => izgara | null }
export function aksiyonuIsle(durum, aksiyon, kimden, baglam = {}) {
  if (!durum || !aksiyon) return null;
  switch (aksiyon.tip) {
    case "baslat": {
      if (durum.faz !== "hazirlik" || kimden !== 1) return null;
      const izgara = baglam.izgaraYap ? baglam.izgaraYap() : null;
      if (!izgara) return { ...durum, faz: "hata" };
      const macNo = (durum.macNo || 0) + 1;
      const ilk = macNo % 2 === 1 ? X : O;   // rövanşta ilk hamle karşı tarafta
      return { ...durum, faz: "oynaniyor", macNo, rovansIstek: [], oyun: izgaraBaslangic(izgara, ilk, null, { calma: true }) };
    }

    case "hamle": {
      if (durum.faz !== "oynaniyor" || !durum.oyun) return null;
      const a = aksiyon.a;
      if (!a || !IZINLI_HAMLELER.has(a.tip)) return null;
      if (durum.oyun.sira !== ISARET[kimden]) return null;      // sıra onda değil
      const yeni = izgaraAksiyonu(durum.oyun, a, { veriSeti: baglam.veriSeti });
      return yeni ? sonuclandir(durum, yeni) : null;
    }

    case "sureDoldu": {
      if (kimden !== 1 || durum.faz !== "oynaniyor" || !durum.oyun) return null;
      if (aksiyon.hamleNo !== durum.oyun.hamleNo) return null;   // bu arada hamle yapılmış
      const yeni = izgaraAksiyonu(durum.oyun, { tip: "sureDoldu" }, { veriSeti: baglam.veriSeti });
      return yeni ? sonuclandir(durum, yeni) : null;
    }

    // Yalnızca iki taraf da istediğinde çağrılır (bkz. onlineRoom.rovansli).
    case "rovans": {
      if (durum.faz !== "macSonu") return null;
      return baslangicDurumu(durum.macNo || 0);
    }

    default:
      return null;
  }
}

// Maç sonu: "sen" | "rakip" | "berabere"
export function sonucBenim(durum, benKimim) {
  const k = durum && durum.oyun && durum.oyun.kazanan;
  if (!k) return null;
  if (k === "berabere") return "berabere";
  return k === ISARET[benKimim] ? "sen" : "rakip";
}

export function kareSayilari(durum, benKimim) {
  const tahta = (durum && durum.oyun && durum.oyun.tahta) || [];
  const ben = ISARET[benKimim];
  return {
    sen: tahta.filter((t) => t === ben).length,
    rakip: tahta.filter((t) => t && t !== ben).length,
  };
}
