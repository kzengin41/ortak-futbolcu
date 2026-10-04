// ============================================================================
// KADROLAR — Günün Kadrosu + Ansiklopedi "Takımlar" (4 Ekim 2026)
// Veri: lib/kadrolar.json (Wikipedia → scripts/kadro_cek.py → Claude'un
// işleme adımı). Oyuncu kaydı: { a: ad, p: hat (GK/DF/MF/FW), n: forma no, v: 1 veri setinde }.
//  • maclar  : efsane maçların GERÇEK ilk 11'i + yedekleri (finaller).
//  • sezonlar: kulüp × sezon kadroları — kadrodan, maç sayısına (yoksa
//              tanınırlığa) göre seçilmiş ilk 11 + 7 yedek.
// Günün Kadrosu sırası lib/gunlukTakvim.json'da sabit ("kadro"), tekrarsız.
// ============================================================================
import VERI from "./kadrolar.json";
import { takvimdenGun, gunNumarasi, gunAnahtari, tohum, uretec } from "./dailyPuzzle";
import TAKVIM from "./gunlukTakvim.json";

export const MACLAR = VERI.maclar || [];
export const SEZONLAR = VERI.sezonlar || [];
const macHarita = new Map(MACLAR.map((m) => [m.id, m]));
const sezonHarita = new Map(SEZONLAR.map((s) => [s.id, s]));

export const HAT_ETIKET = { GK: "KL", DF: "DEF", MF: "OS", FW: "FV" };

// Kadro kimliği: maç takımı "macId#0|1", sezon "Kulüp|2012–13".
export function kadroGetir(id) {
  if (!id) return null;
  const [macId, t] = id.split("#");
  if (t !== undefined && macHarita.has(macId)) {
    const m = macHarita.get(macId);
    const takim = m.takimlar[Number(t)];
    const rakip = m.takimlar[1 - Number(t)];
    if (!takim) return null;
    return { id, tip: "mac", mac: m, takim: takim.ad, takimTip: takim.tip, rakip: rakip?.ad, rakipTip: rakip?.tip, ilk11: takim.ilk11, yedek: takim.yedek || [], baslik: `${m.tur} ${m.yil || ""}`.trim() };
  }
  const s = sezonHarita.get(id);
  if (!s) return null;
  return { id, tip: "sezon", sezon: s, takim: s.kulup, takimTip: "kulup", ilk11: s.ilk11, yedek: s.yedek || [], baslik: `${s.kulup} ${s.sezon}` };
}

// Saha dizilişi: üstte forvetler, altta kaleci. Maç tablolarında sıra sağdan
// sola (RB, CB, CB, LB) yazıldığı için hat içinde ters çevrilir.
export function sahaSatirlari(ilk11, macMi = false) {
  // 5 Ekim 2026 — sezon kadrolarında her oyuncunun sahadaki satırı (r: 0 = en
  // üst/forvet) ve satır içi sırası (soldan sağa) veride hazır: 4-2-3-1'in 10
  // numara hattı gibi ara hatlar ancak böyle çizilebiliyor.
  if (ilk11.length && ilk11.every((o) => Number.isFinite(o.r))) {
    const satir = new Map();
    ilk11.forEach((o, i) => { if (!satir.has(o.r)) satir.set(o.r, []); satir.get(o.r).push({ ...o, i }); });
    return [...satir.keys()].sort((a, b) => a - b).map((r) => satir.get(r));
  }
  const hat = (h) => ilk11.map((o, i) => ({ ...o, i })).filter((o) => o.p === h);
  const sir = (l) => (macMi ? [...l].reverse() : l);
  return [sir(hat("FW")), sir(hat("MF")), sir(hat("DF")), hat("GK")].filter((l) => l.length);
}

export function kadroIsimleri(kadro) {
  return [...kadro.ilk11, ...kadro.yedek].map((o) => o.a);
}

export function tamamlanma(kadro, bulunanlar) {
  const hepsi = [...kadro.ilk11, ...kadro.yedek];
  const bulunan = hepsi.filter((o) => bulunanlar.has(o.a)).length;
  return { bulunan, toplam: hepsi.length, tamam: hepsi.length > 0 && bulunan === hepsi.length };
}

// ------------------------------------------------------------------ Günün Kadrosu
export function gununKadrosu(tarih = gunAnahtari()) {
  const no = gunNumarasi(new Date(`${tarih}T12:00:00`));
  const sira = (TAKVIM && TAKVIM.kadro) || [];
  const bas = (TAKVIM && TAKVIM.kadroBaslangic) || 1;
  let id = null;
  if (sira.length) id = sira[(((no - bas) % sira.length) + sira.length) % sira.length];
  else if (MACLAR.length) {
    const rnd = uretec(tohum("kadro-" + tarih));
    const m = MACLAR[Math.floor(rnd() * MACLAR.length)];
    id = `${m.id}#${Math.floor(rnd() * 2)}`;
  }
  const kadro = kadroGetir(id);
  return kadro ? { ...kadro, no } : null;
}

// Paylaşım: saha düzeninde kareler (üstte forvet).
export function kadroPaylasim(no, kadro, bulunanIndisler, sureMetni) {
  const set = new Set(bulunanIndisler);
  const satirlar = sahaSatirlari(kadro.ilk11, kadro.tip === "mac").map((l) => l.map((o) => (set.has(o.i) ? "🟩" : "🟥")).join(""));
  return [`⚽ 3-2-1: Bitir İşi — Günün Kadrosu #${no}`, `${set.size}/11 · ${sureMetni}`, ...satirlar, "Sen kaç bulursun?"].join("\n");
}

export function sureYaz(sn) {
  const s = Math.max(0, Math.round(sn));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Takımlar sekmesi grupları
export function kulupGruplari() {
  const g = new Map();
  for (const s of SEZONLAR) {
    if (!g.has(s.kulup)) g.set(s.kulup, { kulup: s.kulup, grup: s.grup, sezonlar: [] });
    g.get(s.kulup).sezonlar.push(s.id);
  }
  return [...g.values()];
}
