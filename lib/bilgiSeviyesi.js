// ============================================================================
// BİLGİ SEVİYESİ — 4 Ekim 2026 (futbol bilgisi testinin hafif yarısı)
//
// Testin sorularını üreten lib/bilgiTesti.js players.json yüklüyor; bu dosya
// ise ana sayfa, Ayarlar ve mod varsayılanları gibi hafif yerlerden
// kullanılabilsin diye ayrı ve veri yüklemiyor.
//
//  • settings.bilgiSeviyesi (1–10): testin sonucu. Ayarlar'da bir mod için
//    zorluğu ELLE kaydetmemiş kullanıcının o moddaki varsayılan zorluğu bu.
//  • Oyunda ince ayar: CPU'ya karşı / tek kişilik modlarda son 20 turun
//    kazanma oranı ≥ %75 ise seviye +1, ≤ %30 ise −1 (sonra pencere sıfırlanır).
// ============================================================================
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ayarYaz, guncelAyarlar } from "./SettingsContext";

const PENCERE_ANAHTARI = "bilgi-ince-ayar-penceresi";
export const PENCERE = 20;
export const INCE_AYAR_MODLARI = new Set(["cpu", "draftCpu", "countryTeamCpu", "letterCpu", "whoAmICpu", "quickCpu"]);

export function seviyeEtiketi(s) {
  if (s <= 2) return "Yeni başlıyor";
  if (s <= 4) return "Taraftar";
  if (s <= 6) return "Futbolsever";
  if (s <= 8) return "Uzman";
  return "Ansiklopedi";
}

export function oneriEtiketi(oneri) {
  if (!oneri) return "Dengeli";
  const parca = [];
  if (oneri.temel === "turkiye") parca.push("Türkiye ağırlıklı");
  else if (oneri.bolge === 3) parca.push("Avrupa ağırlıklı");
  else parca.push("Dengeli");
  if (oneri.donem === "guncel") parca.push("güncel oyuncular");
  else if (oneri.donem === "nostalji") parca.push("nostalji");
  else parca.push("her dönemden");
  return parca.join(" · ");
}

// Öneriyi profile uygular; takım, takım oranı ve Detaylı ayarlar korunur.
export function oneriyiUygula(profil, oneri) {
  return { ...profil, temel: oneri.temel, bolge: oneri.bolge, donem: oneri.donem };
}

// Mod varsayılan zorluğu. Kim Bu'da zorluk "başlangıç seviyesi" ve her doğruda
// zaten artıyor, o yüzden iki basamak aşağıdan başlar.
export function moddaZorluk(modId, bilgiSeviyesi) {
  if (!Number.isFinite(bilgiSeviyesi)) return null;
  const z = modId === "whoAmICpu" ? bilgiSeviyesi - 2 : bilgiSeviyesi;
  return Math.max(1, Math.min(10, Math.round(z)));
}

export function inceAyar(seviye, pencere) {
  if (!Number.isFinite(seviye) || pencere.length < PENCERE) return { seviye, pencere };
  const son = pencere.slice(-PENCERE);
  const oran = son.filter(Boolean).length / son.length;
  if (oran >= 0.75 && seviye < 10) return { seviye: seviye + 1, pencere: [] };
  if (oran <= 0.3 && seviye > 1) return { seviye: seviye - 1, pencere: [] };
  return { seviye, pencere: son };
}

// lib/stats.js recordRound her turda çağırır.
export async function turuIsle(modId, kazandi) {
  if (!INCE_AYAR_MODLARI.has(modId)) return;
  const sev = guncelAyarlar()?.bilgiSeviyesi;
  if (!Number.isFinite(sev)) return; // test çözülmeden ince ayar yok
  let pencere = [];
  try { pencere = JSON.parse((await AsyncStorage.getItem(PENCERE_ANAHTARI)) || "[]"); } catch (e) {}
  if (!Array.isArray(pencere)) pencere = [];
  pencere.push(kazandi ? 1 : 0);
  const s = inceAyar(sev, pencere);
  await AsyncStorage.setItem(PENCERE_ANAHTARI, JSON.stringify(s.pencere)).catch(() => {});
  if (s.seviye !== sev) await ayarYaz("bilgiSeviyesi", s.seviye);
}

export function pencereyiSifirla() {
  return AsyncStorage.removeItem(PENCERE_ANAHTARI).catch(() => {});
}
