// ============================================================================
// GÜNLÜK KİM BU — Paket 13 (5 Ekim 2026, benchmark "Kim Bu — Modlar")
// "Herkese aynı futbolcu, 5 tahmin hakkı, paylaşım: çevrilen kartların
// kareleri + puan."
//
// Futbolcu lib/gunlukTakvim.json "kimBu" listesinden (730 tanınmış isim, sabit
// sıra): veri dosyaları güncellense de aynı gün herkes aynı futbolcuyu görür.
// Masadaki başta açık kart da günün tohumuyla seçilir.
// ============================================================================
import TAKVIM from "./gunlukTakvim.json";
import { gunAnahtari, gunNumarasi } from "./dailyPuzzle";
import { tohum, uretec } from "./tohum";

export const TAHMIN_HAKKI = 5;

export function gununKimBu(tarih = gunAnahtari()) {
  const liste = (TAKVIM && TAKVIM.kimBu) || [];
  if (!liste.length) return null;
  const no = gunNumarasi(new Date(`${tarih}T12:00:00`));
  const bas = (TAKVIM && TAKVIM.kimBuBaslangic) || 1;
  const i = (((no - bas) % liste.length) + liste.length) % liste.length;
  return { ad: liste[i], no: Math.max(1, no - bas + 1), tarih };
}

export function gununRastgelesi(tarih = gunAnahtari()) {
  return uretec(tohum("gunluk-kim-bu-masa-" + tarih));
}

const KARE = { baslangic: "🟦", satin: "🟨", bedava: "🟩" };
export function kareSatiri(kartlar, acik) {
  return kartlar.map((k) => KARE[acik[k.id]] || "⬛").join("");
}

export function paylasimMetni({ no, masa, acik, yanlis, dogru, puan }) {
  const sayi = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return [
    `🃏 Günlük Kim Bu #${no}`,
    kareSatiri(masa.kimlik, acik),
    kareSatiri(masa.kariyer, acik),
    masa.vitrin.length ? kareSatiri(masa.vitrin, acik) : null,
    "❌".repeat(yanlis) + (dogru ? "✅" : ""),
    dogru ? `${sayi(puan)} puan` : "Bu sefer bilemedim",
    "⚽ 3-2-1: Bitir İşi",
  ].filter((x) => x !== null && x !== "").join("\n");
}
