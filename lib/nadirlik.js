// ============================================================================
// NADİRLİK — Paket 46 (Kerem: "aşırı zevkli yapmak lazım" → "Kart paketi ve
// koleksiyon")
//
// Her futbolcu kartının bir nadirliği var; Türkiye'deki tanınırlığından
// (lib/taninirlik.js, 0–100) çıkar:
//   EFSANE  ≥ 99,6  (~170 isim: Messi, Ronaldo, Hagi, Alex…)
//   NADİR   ≥ 98,5  (~700 isim)
//   SIRADAN   geri kalanı
// Kart paketinde (components/KartPaketi.js), ödül kartında, açılma bildiriminde
// ve Profilim → koleksiyonda görünür. Saf modül (Node'da test: t65).
// ============================================================================
import { _t } from "./dil";
import { taninirlik, taninirlikTablosu } from "./taninirlik";

export const EFSANE_ESIK = 99.6;
export const NADIR_ESIK = 98.5;

export const NADIRLIKLER = {
  efsane: { id: "efsane", ad: _t("EFSANE"), renk: "#FFC93C", zemin: "#3A2A05", sira: 3 },
  nadir: { id: "nadir", ad: _t("NADİR"), renk: "#B98CFF", zemin: "#26164A", sira: 2 },
  siradan: { id: "siradan", ad: _t("SIRADAN"), renk: "#9FB3A8", zemin: "#16241D", sira: 1 },
};
export const NADIRLIK_SIRASI = ["efsane", "nadir", "siradan"];

export function nadirlikId(oyuncu) {
  const t = taninirlik(oyuncu);
  return t >= EFSANE_ESIK ? "efsane" : t >= NADIR_ESIK ? "nadir" : "siradan";
}
export function nadirlik(oyuncu) {
  return NADIRLIKLER[nadirlikId(oyuncu)];
}

// Koleksiyon sayacı: { efsane: {acik, toplam}, nadir: {…}, siradan: {…} } —
// toplam tanınırlık tablosundaki futbolcu sayısı; bir kez hesaplanır.
let _toplam = null;
function toplamlar() {
  if (_toplam) return _toplam;
  const say = { efsane: 0, nadir: 0, siradan: 0 };
  for (const v of Object.values(taninirlikTablosu())) {
    const t = Array.isArray(v) ? v[0] || 0 : 0;
    say[t >= EFSANE_ESIK ? "efsane" : t >= NADIR_ESIK ? "nadir" : "siradan"]++;
  }
  _toplam = say;
  return say;
}
export function koleksiyonSayilari(acilanAdlar) {
  const t = toplamlar();
  const acik = { efsane: 0, nadir: 0, siradan: 0 };
  for (const ad of new Set(acilanAdlar || [])) acik[nadirlikId(ad)]++;
  return {
    efsane: { acik: acik.efsane, toplam: t.efsane },
    nadir: { acik: acik.nadir, toplam: t.nadir },
    siradan: { acik: acik.siradan, toplam: t.siradan },
  };
}

// Paketteki kartları en nadirden başlayarak değil, SONA saklayarak sırala:
// sıradanlar önce, efsane en son çevrilir (heyecan sonda).
export function paketSirasi(adlar) {
  return [...(adlar || [])].sort((a, b) => NADIRLIKLER[nadirlikId(a)].sira - NADIRLIKLER[nadirlikId(b)].sira);
}
