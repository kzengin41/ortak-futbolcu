// ============================================================================
// KADRO İPUCU — Paket 44 (2 Kasım 2026)
// Kerem: "efsane maçların 11'leri yabancı ya. mesela 1996 liverpool x newcastle
// maçı. bilme ihtimalim yok. ipucu almaca olsa keşke. Yani mesele bildirmemek
// değil de uğraşarak bildirmek olsa. kadroda birine tıkla ipucu al diye
// yönlendirelim. kaleciye mesela tıklasın, ipucu çıksın. yaş, baş harf,
// milliyet falan. harf alma olsun. alınca bir harf daha çıksın. Bir ödül potu
// olmadığı için sınırsız alsın."
//
// Sahada kapalı bir oyuncuya dokununca ipucu paneli açılır
// (components/KadroIpucuPaneli.js). İpuçları:
//   milli  — uyruk (bayrak + ülke)
//   yas    — maç günündeki yaşı (tarih yoksa maç yılından, "~")
//   boy    — boyu
//   bas    — ad ve soyadının baş harfleri
//   harf   — "Harf al": her basışta bir harf daha (sınırsız; ad tamamen açılabilir)
// Harf sırası: önce baş harfler, sonra kelimeler arasında sırayla 2., 3. … harf.
// Bu dosya saf (veri + hesap); Node'da test ediliyor (t62).
// ============================================================================
import { PLAYER_NATIONALITY } from "./playerNationality";
import { PLAYER_NATIONAL_TEAMS } from "./playerNationalTeams";

let _profiller = null;
function profil(ad) {
  if (!_profiller) { try { _profiller = require("./paket/playerProfiles"); } catch (e) { _profiller = {}; } }
  return (_profiller && _profiller[ad]) || null;
}

export const IPUCU_TURLERI = ["milli", "yas", "boy", "bas"];

const HARF = /[\p{L}\p{N}]/u;

// Adın harf konumları, açılma sırasıyla: önce her kelimenin ilk harfi, sonra
// kelimeler arasında sırayla 2., 3. … harfleri.
export function harfSirasi(ad) {
  const s = [...String(ad || "")];
  const kelimeler = [];
  let k = null;
  s.forEach((ch, i) => {
    if (HARF.test(ch)) { if (!k) { k = []; kelimeler.push(k); } k.push(i); }
    else k = null;
  });
  const sira = [];
  const enUzun = Math.max(0, ...kelimeler.map((w) => w.length));
  for (let j = 0; j < enUzun; j++) for (const w of kelimeler) if (j < w.length) sira.push(w[j]);
  return { sira, kelimeSayisi: kelimeler.length, harfSayisi: sira.length };
}

// Ekranda gösterilecek maske: [{ ch, acik, harf }] — harf olmayanlar (boşluk,
// tire, kesme) her zaman görünür. `acikSayisi`: sıradaki ilk kaç harf açık.
export function maskele(ad, acikSayisi) {
  const s = [...String(ad || "")];
  const { sira } = harfSirasi(ad);
  const acik = new Set(sira.slice(0, Math.max(0, acikSayisi || 0)));
  return s.map((ch, i) => {
    const harf = HARF.test(ch);
    return { ch, harf, acik: !harf || acik.has(i) };
  });
}

// Durum: { k: ["milli", …] açılan ipuçları, h: açılan harf sayısı }
export function bosDurum() {
  return { k: [], h: 0 };
}

// Kaç harf açık? "Baş harfler" ipucu açıksa en az kelime sayısı kadar.
export function acikHarf(ad, durum) {
  const { kelimeSayisi, harfSayisi } = harfSirasi(ad);
  const d = durum || bosDurum();
  const taban = (d.k || []).includes("bas") ? kelimeSayisi : 0;
  return Math.min(harfSayisi, Math.max(taban, d.h || 0));
}

export function ipucuAc(durum, tur) {
  const d = durum || bosDurum();
  if ((d.k || []).includes(tur)) return d;
  return { ...d, k: [...(d.k || []), tur] };
}

// Bir harf daha: baş harfler açıksa onların ÜSTÜNE eklenir.
export function harfAl(ad, durum) {
  const d = durum || bosDurum();
  const { harfSayisi } = harfSirasi(ad);
  const simdi = acikHarf(ad, d);
  if (simdi >= harfSayisi) return d;
  return { ...d, h: simdi + 1 };
}

export function tamamenAcikMi(ad, durum) {
  return acikHarf(ad, durum) >= harfSirasi(ad).harfSayisi;
}

// Paylaşımda / sonuçta gösterilen ipucu sayısı (her ipucu ve her alınan harf 1).
export function ipucuSayisi(durum) {
  if (!durum) return 0;
  return (durum.k || []).length + (durum.h || 0);
}
export function toplamIpucu(durumlar) {
  return Object.values(durumlar || {}).reduce((t, d) => t + ipucuSayisi(d), 0);
}

// ---------------------------------------------------------------- veriler
export function uyrugu(ad) {
  const u = PLAYER_NATIONALITY[ad];
  if (u && u.length) return u[0];
  const m = PLAYER_NATIONAL_TEAMS[ad];
  return m && m.length ? m[0] : null;
}

// Maç günündeki yaş. Maç tarihi biliniyorsa tam; yoksa yıl farkı (yaklaşık).
export function macYasi(ad, mac) {
  const p = profil(ad);
  const d = p && p.d ? String(p.d) : null;
  if (!d || !mac) return null;
  const [dy, dm, dg] = d.split("-").map(Number);
  if (!dy) return null;
  if (mac.tarih) {
    const [my, mm, mg] = String(mac.tarih).split("-").map(Number);
    if (my) {
      let yas = my - dy;
      if ((mm || 1) < (dm || 1) || ((mm || 1) === (dm || 1) && (mg || 1) < (dg || 1))) yas -= 1;
      return { yas, yaklasik: false };
    }
  }
  if (mac.yil) return { yas: Number(mac.yil) - dy, yaklasik: true };
  return null;
}

export function boyu(ad) {
  const p = profil(ad);
  const b = p && Number(p.b);
  return b && b > 140 && b < 220 ? b : null;
}

// Panelin göstereceği bütün ipuçları (yoksa null → düğme pasif).
export function ipucuVerisi(ad, mac) {
  return { milli: uyrugu(ad), yas: macYasi(ad, mac), boy: boyu(ad) };
}

// Sahada kapalı oyuncunun altına: soyadının maskesi ("F·w·e·"), harf açılmadıysa null.
export function kisaMaske(ad, acikSayisi) {
  if (!acikSayisi) return null;
  const m = maskele(ad, acikSayisi);
  // son kelime
  let bas = m.length;
  while (bas > 0 && m[bas - 1].harf) bas--;
  if (bas === m.length) return null;
  const son = m.slice(bas);
  if (!son.some((p) => p.acik)) {
    // soyadında açık harf yoksa ilk kelimeden göster
    const ilk = [];
    for (const p of m) { if (!p.harf) break; ilk.push(p); }
    return ilk.map((p) => (p.acik ? p.ch : "·")).join("");
  }
  return son.map((p) => (p.acik ? p.ch : "·")).join("");
}
