// ============================================================================
// ROZETLER / BAŞARIMLAR — Paket 34 (15 Ekim 2026)
// Kerem: "… bazı bildirimlerle veya challenge'larla vs. o modlara yönlendirsin"
// → seçtikleri arasında "Rozet / başarım koleksiyonu".
// Her oyun ailesinin kademeli rozeti var (Bronz → Gümüş → Altın → Efsane);
// bir sonraki kademeye ne kaldığı Profilim'de görünür — oyuncuyu az oynadığı
// modlara da çeker. Yeni veri tutulmuyor: hepsi zaten kaydedilen istatistikten
// (lib/stats.js), ansiklopediden ve günlük seriden hesaplanıyor. Görülen
// kademeler ayrıca saklanır; maç sonunda "Yeni rozet!" bir kez çıkar.
// ============================================================================
import { _t } from "./dil";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MOD_GRUBU } from "./gununModu";

import { COLORS } from "./theme";
// Açık temada (Gündüz) madalya renkleri koyulaşır — açık gümüş beyaz kartta kaybolur.
export const KADEMELER = COLORS.acik ? [
  { ad: _t("Bronz"), renk: "#B4642B" },
  { ad: _t("Gümüş"), renk: "#64748B" },
  { ad: _t("Altın"), renk: "#B7860B" },
  { ad: _t("Efsane"), renk: "#7C3AED" },
] : [
  { ad: _t("Bronz"), renk: "#D9925B" },
  { ad: _t("Gümüş"), renk: "#C8D2DE" },
  { ad: _t("Altın"), renk: "#F4C430" },
  { ad: _t("Efsane"), renk: "#B794FF" },
];

// olcu: istatistik özetinden sayı çıkaran anahtar (bkz. ozetCikar)
export const ROZETLER = [
  { id: "ortak", ad: _t("Ortak Futbolcu Avcısı"), ikon: "ortakKulup", olcu: "ortak", birim: "doğru", esik: [10, 50, 200, 1000] },
  { id: "five", ad: _t("5 Kulüp Ustası"), ikon: "besKulup", olcu: "five", birim: "doğru", esik: [10, 50, 200, 800] },
  { id: "xox", ad: _t("XOX Stratejisti"), ikon: "xox", olcu: "xox", birim: "doğru", esik: [10, 50, 200, 800] },
  { id: "kimbu", ad: _t("Dedektif"), ikon: "kimBu", olcu: "kimbu", birim: "doğru", esik: [10, 50, 200, 800] },
  { id: "harf", ad: _t("Harf Ustası"), ikon: "ilkHarf", olcu: "harf", birim: "doğru", esik: [10, 50, 200, 800] },
  { id: "online", ad: _t("Online Gladyatör"), ikon: "online", olcu: "online", birim: "doğru", esik: [5, 25, 100, 400] },
  { id: "seri", ad: _t("Durdurulamaz"), ikon: "hemenOyna", olcu: "seri", birim: _t("üst üste doğru"), esik: [5, 10, 20, 40] },
  { id: "koleksiyon", ad: _t("Koleksiyoncu"), ikon: "ansiklopedi", olcu: "acilan", birim: "futbolcu", esik: [25, 100, 500, 2000] },
  { id: "gunluk", ad: _t("Her Gün Sahada"), ikon: "gunluk", olcu: "gunlukSeri", birim: _t("gün seri"), esik: [3, 7, 30, 100] },
];

// stats (lib/stats.js), açılan futbolcu sayısı ve en iyi günlük seri → ölçüler
export function ozetCikar(stats, acilanSayisi = 0, gunlukEnIyi = 0) {
  const o = { ortak: 0, five: 0, xox: 0, kimbu: 0, harf: 0, online: 0, seri: 0, acilan: acilanSayisi || 0, gunlukSeri: gunlukEnIyi || 0 };
  const modlar = (stats && stats.modes) || {};
  for (const [mod, m] of Object.entries(modlar)) {
    const g = MOD_GRUBU[mod];
    const w = (m && m.wins) || 0;
    if (g && o[g] !== undefined) o[g] += w;
    if (mod.startsWith("online")) o.online += w;
  }
  o.seri = (stats && stats.bestStreak) || 0;
  return o;
}

export function rozetDurumu(ozet) {
  return ROZETLER.map((r) => {
    const deger = ozet[r.olcu] || 0;
    let kademe = 0;
    while (kademe < r.esik.length && deger >= r.esik[kademe]) kademe++;
    const sonraki = kademe < r.esik.length ? r.esik[kademe] : null;
    const onceki = kademe > 0 ? r.esik[kademe - 1] : 0;
    const ilerleme = sonraki ? Math.max(0, Math.min(1, (deger - onceki) / (sonraki - onceki))) : 1;
    return { ...r, deger, kademe, sonraki, ilerleme };
  });
}

export function toplamKademe(durum) {
  return durum.reduce((t, r) => t + r.kademe, 0);
}

// --- canlı veri ------------------------------------------------------------
export async function rozetleriOku() {
  const [{ getStats }, { getUnlockedPlayers }, { getStreak, seriDurumu }] = [require("./stats"), require("./pokedex"), require("./streak")];
  const [stats, acilan, seri] = await Promise.all([
    getStats().catch(() => null),
    getUnlockedPlayers().catch(() => []),
    getStreak().catch(() => null),
  ]);
  const enIyi = seri ? seriDurumu(seri).enIyi || 0 : 0;
  return rozetDurumu(ozetCikar(stats, (acilan || []).length, enIyi));
}

const GORULEN = "rozet-gorulen-v1";
// Yeni kazanılan kademeler (görülmemiş) — döndürür ve "görüldü" işaretler.
export async function yeniRozetleriAl(durum) {
  const d = durum || (await rozetleriOku());
  let gorulen = {};
  try { gorulen = JSON.parse((await AsyncStorage.getItem(GORULEN)) || "{}"); } catch (e) {}
  const ilkKez = !Object.keys(gorulen).length;
  const yeni = [];
  const kayit = {};
  for (const r of d) {
    kayit[r.id] = r.kademe;
    if (!ilkKez && r.kademe > (gorulen[r.id] || 0)) yeni.push(r);
  }
  try { await AsyncStorage.setItem(GORULEN, JSON.stringify(kayit)); } catch (e) {}
  return yeni;   // ilk açılışta mevcut rozetler "yeni" sayılmaz (eski oyunculara 9 rozet birden çıkmasın)
}
