// ============================================================================
// GÜNÜN MODU · 2× XP — Paket 34 (15 Ekim 2026)
// Kerem: "oyunun oyun olduğu belli olsun … ama uygulamanın zenginliği de
// kaybolmasın. hem modlar ulaşılabilir olsun hem de … challenge'larla o
// modlara yönlendirsin." Karar: "Günün modu · 2× XP".
//
// Her gün (yerel tarih) 3-2-1 dışındaki dört oyundan biri öne çıkar ve o modda
// kazanılan bütün XP iki katına çıkar. Sabit karışık sırayla gün gün döner
// (dört günde hepsi gelir, aynı mod iki gün üst üste gelmez).
// "Hangi moddayım" bilgisi App.js'teki ekran sarmalayıcılarından gelir
// (aktifModEkle) — addXP (lib/profile.js) çarpanı buradan okur. Böylece 20 ayrı
// ekranda XP koduna dokunmak gerekmiyor; yeni modlar da otomatik kapsanır.
// ============================================================================
import { _t } from "./dil";
import { tohum, uretec } from "./tohum";

export const GUNUN_MODLARI = [
  { grup: "five", ad: _t("5 Kulüp"), modKey: "fiveClubs", ikon: "besKulup" },
  { grup: "xox", ad: _t("Futbolcu XOX"), modKey: "xox", ikon: "xox" },
  { grup: "kimbu", ad: _t("Kim Bu Futbolcu?"), modKey: "whoAmI", ikon: "kimBu" },
  { grup: "harf", ad: _t("İlk Harf"), modKey: "letters", ikon: "ilkHarf" },
];

// Rota / mod kimliği → grup (CPU, yanımdaki, online, tek başına hepsi sayılır)
export const MOD_GRUBU = {
  fiveClubs: "five", fiveClubsCpu: "five", onlineFive: "five",
  xox: "xox", xoxCpu: "xox", onlineXox: "xox",
  whoAmICpu: "kimbu", kadroAvi: "kimbu", onlineWhoAmI: "kimbu",
  letterCpu: "harf", letterZincir: "harf", onlineLetter: "harf",
  cpu: "ortak", countryTeamCpu: "ortak", draftCpu: "ortak", local: "ortak", sunucu: "ortak",
  onlineDuel: "ortak", onlineDraft: "ortak", onlineUlke: "ortak", quickCpu: "ortak",
};

export const XP_CARPANI = 2;

function tarihMetni(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Gün numarası (yerel tarih).
function gunNo(d) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// Sabit, karışık bir sıra (bir kez tohumla) — gün gün döner: dört günde hepsi
// gelir, aynı mod hiçbir zaman iki gün üst üste gelmez.
const SIRA = (() => {
  const rnd = uretec(tohum("gunun-modu"));
  return GUNUN_MODLARI.map((m) => ({ m, r: rnd() })).sort((a, b) => a.r - b.r).map((x) => x.m);
})();

export function gununModu(d = new Date()) {
  return SIRA[((gunNo(d) % SIRA.length) + SIRA.length) % SIRA.length];
}

// --- aktif ekran ---------------------------------------------------------
// Yığın: ekran değişirken (replace) yeni ekran eskisinden ÖNCE bağlanabilir;
// her ekran kendi girdisini ekleyip çıkarır, geçerli olan en son eklenen.
const _yigin = [];
export function aktifModEkle(mod) {
  const g = { mod: mod || null };
  _yigin.push(g);
  return () => { const i = _yigin.indexOf(g); if (i >= 0) _yigin.splice(i, 1); };
}
export function aktifMod() { return _yigin.length ? _yigin[_yigin.length - 1].mod : null; }

export function modGununModuMu(mod, d = new Date()) {
  const g = MOD_GRUBU[mod];
  return !!g && g === gununModu(d).grup;
}

// addXP çarpanı: şu an açık ekran günün modundaysa 2, değilse 1.
export function xpCarpani(d = new Date()) {
  const a = aktifMod();
  return a && modGununModuMu(a, d) ? XP_CARPANI : 1;
}

export { tarihMetni };
