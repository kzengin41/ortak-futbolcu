// ============================================================================
// KİM BU — ORTAK VERİ YARDIMCILARI (Paket 13, 5 Ekim 2026)
// Kart masası artık dört yerde: Seri (CPU), Günlük Kim Bu, Kadro Avı ve
// Online düello. Veri yükleme + "bu futbolcu için masa kur" tek yerde dursun
// diye WhoAmICpuScreen'den buraya taşındı. Kurallar lib/kimBuMasa.js'te.
// ============================================================================
import { PLAYERS } from "./players";
import { PLAYER_BIRTH_POSITION } from "./playerBirthPosition";
import { PLAYER_NATIONAL_TEAMS } from "./playerNationalTeams";
import { resolvePlayerPhotoUrl, PLAYER_PHOTO_FILENAME } from "./playerPhotos";
import { oyuncuBasarilari } from "./basarilar";
import { findMatchedPlayer } from "./gameEngine";
import { masaKur, unluTakimArkadasi, karsilastir } from "./kimBuMasa";

let _profiller = null, _tanin = null, _kulupUlkesi = null;
export function profiller() {
  if (!_profiller) { try { _profiller = require("./playerProfiles.json"); } catch (e) { _profiller = {}; } }
  return _profiller;
}
export function tanin() {
  if (!_tanin) { try { _tanin = require("./playerFame.json"); } catch (e) { _tanin = {}; } }
  return _tanin;
}
export function kulupUlkesi() {
  if (!_kulupUlkesi) { try { _kulupUlkesi = require("./clubCountries.json"); } catch (e) { _kulupUlkesi = {}; } }
  return _kulupUlkesi;
}

let _oyuncu = null;
export function oyuncuGetir(ad) {
  if (!_oyuncu) { _oyuncu = new Map(); for (const p of PLAYERS) if (!_oyuncu.has(p.name)) _oyuncu.set(p.name, p); }
  return _oyuncu.get(ad) || null;
}

export function taninirlik(ad) {
  const t = tanin()[ad];
  return t ? Math.max(t[0] || 0, t[1] || 0) : 0;
}

// Fotoğrafı GÜVENİLİR mi (bulanık foto kartı ve sonuç ekranı için).
export function guvenilirFotoVar(ad) {
  const ham = PLAYER_PHOTO_FILENAME[ad];
  const cozulmus = resolvePlayerPhotoUrl(ad);
  if (!cozulmus) return false;
  if (!ham) return true;
  if (!/^https?:\/\//i.test(ham)) return false;
  return !/cloudfront/i.test(ham);
}

export function oyuncuVerisi(ad) {
  const pr = profiller()[ad] || null;
  return {
    profil: pr,
    dogumMevki: PLAYER_BIRTH_POSITION[ad] || {},
    milliler: PLAYER_NATIONAL_TEAMS[ad] || [],
    basarilar: oyuncuBasarilari(ad),
    basariSayilari: pr && pr.bs,
  };
}

// Bir futbolcu için masa kur (rastgele: başta açık kartın seçimi; günlükte tohumlu).
export function masaHazirla(oyuncu, rastgele = Math.random) {
  const veri = oyuncuVerisi(oyuncu.name);
  veri.arkadas = unluTakimArkadasi(oyuncu, veri.profil, PLAYERS, profiller(), tanin());
  veri.fotoVar = guvenilirFotoVar(oyuncu.name);
  return masaKur(oyuncu, veri, rastgele);
}

// Tahmin edilen futbolcuyu gizliyle karşılaştır (karşılaştırma satırı).
export function karsilastirAd(tahminAd, gizliAd) {
  const t = oyuncuGetir(tahminAd), g = oyuncuGetir(gizliAd);
  if (!t || !g) return null;
  return karsilastir(t, g, oyuncuVerisi(tahminAd), oyuncuVerisi(gizliAd), kulupUlkesi());
}

// Metin gizli futbolcu mu? / hangi futbolcu?
export function gizliMi(metin, gizliAd) {
  const g = oyuncuGetir(gizliAd);
  return !!(g && findMatchedPlayer(String(metin || "").trim(), [g]));
}
export function oyuncuBul(metin) {
  return findMatchedPlayer(String(metin || "").trim(), PLAYERS) || null;
}

// Online/Kadro dışı havuz: 2+ kulüp, güvenilir fotoğraf, tanınırlığa göre.
let _havuz = null;
export function taninmisHavuz(adet = 600) {
  if (!_havuz) {
    const gorulen = new Set();
    _havuz = PLAYERS.filter((p) => {
      if (gorulen.has(p.name)) return false;
      gorulen.add(p.name);
      return p.clubs && p.clubs.length >= 2 && guvenilirFotoVar(p.name);
    })
      .map((p) => [p, taninirlik(p.name)])
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
  }
  return _havuz.slice(0, adet);
}
