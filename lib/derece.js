// ============================================================================
// DERECE (ELO) — Paket 23 (11 Ekim 2026)
// Sunucu tarafı: supabase/paket23_derece.sql. Puanı YALNIZ sunucu hesaplar;
// burası bildirir, okur ve gösterir.
//   • Rastgele rakip / Hızlı Eşleş maçları dereceli, arkadaş odası dostluk.
//   • Maç sonunda iki taraf da sonucu bildirir; aynıysa puan işlenir.
//   • Tek "Online Puan", başlangıç 1000; ilk 10 maç yerleştirme.
// ============================================================================
import { _t } from "./dil";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, oturumKimligi, anonimOturumMu } from "./supabaseClient";

const ONBELLEK = "ortak-futbolcu-derece";
const DEVIR = "ortak-futbolcu-derece-devir";
export const BASLANGIC_PUANI = 1000;
export const YERLESTIRME_MAC = 10;

export const LIGLER = [
  { id: "amator", ad: _t("Amatör Lig"), yonelme: "Amatör Lig'e", alt: 0, renk: "#9AA4AE", ikon: "football-outline" },
  { id: "lig3", ad: _t("3. Lig"), yonelme: "3. Lig'e", alt: 900, renk: "#C08A4E", ikon: "shield-outline" },
  { id: "lig2", ad: _t("2. Lig"), yonelme: "2. Lig'e", alt: 1100, renk: "#B9C4D0", ikon: "shield-half" },
  { id: "lig1", ad: _t("1. Lig"), yonelme: "1. Lig'e", alt: 1250, renk: "#F2C94C", ikon: "shield" },
  { id: "super", ad: _t("Süper Lig"), yonelme: "Süper Lig'e", alt: 1400, renk: "#5EA8FF", ikon: "trophy-outline" },
  { id: "sampiyon", ad: _t("Şampiyonlar Ligi"), yonelme: _t("Şampiyonlar Ligi'ne"), alt: 1600, renk: "#C9B6FF", ikon: "trophy" },
];

// puan -> { lig, sonraki, kalan (sonraki lige), ilerleme 0..1 }
export function ligBul(puan) {
  const p = Number.isFinite(puan) ? puan : BASLANGIC_PUANI;
  let i = 0;
  for (let k = 0; k < LIGLER.length; k++) if (p >= LIGLER[k].alt) i = k;
  const lig = LIGLER[i];
  const sonraki = LIGLER[i + 1] || null;
  const ilerleme = sonraki ? Math.max(0, Math.min(1, (p - lig.alt) / (sonraki.alt - lig.alt))) : 1;
  return { lig, sonraki, kalan: sonraki ? sonraki.alt - p : 0, ilerleme };
}

// ---------------------------------------------------------------- takma ad
// Sunucudaki kuralın (public._ad_uygun_mu) aynısı; anında geri bildirim için.
const YASAK = [
  "amk", "aq", "amq", "amina", "amcik", "orospu", "orosbu", "pic", "pezevenk", "sik", "sikerim", "sikik", "siktir",
  "yarrak", "yarak", "got", "gotveren", "ibne", "kahpe", "kaltak", "oc", "anani", "bok", "salak", "gerizekal",
  "serefsiz", "haysiyetsiz", "pust", "kancik", "dalyarak", "fuck", "shit", "bitch", "nigger", "nigga", "whore",
  "cunt", "pussy", "admin", "moderator", "yonetici",
];
const TR = { "ç": "c", "ğ": "g", "ı": "i", "İ": "i", "ö": "o", "ş": "s", "ü": "u", "Ç": "c", "Ğ": "g", "Ö": "o", "Ş": "s", "Ü": "u" };
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b" };
export function adSorunu(ad) {
  const t = String(ad || "").trim();
  if (t.length < 3) return _t("En az 3 karakter olmalı.");
  if (t.length > 16) return _t("En fazla 16 karakter olmalı.");
  if (!/^[A-Za-z0-9ÇĞİÖŞÜçğıöşü ._-]+$/.test(t)) return _t("Sadece harf, rakam, boşluk ve . _ - kullanılabilir.");
  const n = t.replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c]).toLowerCase().replace(/[^a-z0-9]/g, "").replace(/[0134578]/g, (c) => LEET[c]);
  for (const k of YASAK) {
    if (k.length <= 3 ? n === k : n.includes(k)) return _t("Bu ad kullanılamaz, başka bir ad dene.");
  }
  return null;
}

// ---------------------------------------------------------------- kendi kartım
const dinleyiciler = new Set();
let _son = null;
function yay(k) { _son = k; dinleyiciler.forEach((f) => { try { f(k); } catch (e) {} }); }

export async function onbellektekiDerece() {
  if (_son) return _son;
  try { const s = await AsyncStorage.getItem(ONBELLEK); if (s) _son = JSON.parse(s); } catch (e) {}
  return _son;
}

// Sunucudan taze kart (yoksa açılır). İnternet yoksa önbellek.
export async function derecemiGetir() {
  try {
    await oturumKimligi();
    const { data, error } = await supabase.rpc("derece_benim");
    if (error || !data || data.durum !== "tamam") return await onbellektekiDerece();
    const kart = { ...data };
    try { await AsyncStorage.setItem(ONBELLEK, JSON.stringify(kart)); } catch (e) {}
    yay(kart);
    return kart;
  } catch (e) {
    return await onbellektekiDerece();
  }
}

// Ekranlar için: { kart, yukleniyor, tazele }
export function useDerece({ otomatik = true } = {}) {
  const [kart, setKart] = useState(_son);
  const [yukleniyor, setYukleniyor] = useState(!_son);
  useEffect(() => {
    let canli = true;
    const f = (k) => canli && setKart(k);
    dinleyiciler.add(f);
    onbellektekiDerece().then((k) => { if (canli && k) setKart(k); });
    if (otomatik) derecemiGetir().finally(() => canli && setYukleniyor(false));
    else setYukleniyor(false);
    return () => { canli = false; dinleyiciler.delete(f); };
  }, [otomatik]);
  return { kart, yukleniyor, tazele: derecemiGetir };
}

export async function takmaAdAyarla(ad) {
  const sorun = adSorunu(ad);
  if (sorun) return { tamam: false, mesaj: sorun };
  try {
    await oturumKimligi();
    const { data, error } = await supabase.rpc("derece_ad_ayarla", { p_ad: String(ad).trim() });
    if (error) return { tamam: false, mesaj: _t("Kaydedilemedi, internetini kontrol et.") };
    if (!data || data.durum !== "tamam") return { tamam: false, mesaj: _t("Bu ad kullanılamaz, başka bir ad dene.") };
    await derecemiGetir();
    return { tamam: true, ad: data.takma_ad };
  } catch (e) {
    return { tamam: false, mesaj: _t("Kaydedilemedi, internetini kontrol et.") };
  }
}

// ---------------------------------------------------------------- maç sonucu
// kazanan: mutlak oyuncu numarası 1 / 2, berabere 0.
const bildirilenler = new Set();
export async function macSonucuBildir({ odaId, macNo = 1, kazanan, rakipAyrildi = false }) {
  const anahtar = `${odaId}#${macNo}`;
  if (!odaId || bildirilenler.has(anahtar)) return null;
  bildirilenler.add(anahtar);
  try {
    const { data, error } = await supabase.rpc("derece_bildir", {
      p_oda: odaId, p_mac_no: macNo, p_kazanan: kazanan, p_rakip_ayrildi: !!rakipAyrildi,
    });
    if (error) { bildirilenler.delete(anahtar); return { durum: "hata" }; }
    return data || { durum: "hata" };
  } catch (e) {
    bildirilenler.delete(anahtar);
    return { durum: "hata" };
  }
}

export async function macDurumu(odaId, macNo = 1) {
  try {
    const { data, error } = await supabase.rpc("derece_mac_durumu", { p_oda: odaId, p_mac_no: macNo });
    if (error) return { durum: "hata" };
    return data || { durum: "hata" };
  } catch (e) {
    return { durum: "hata" };
  }
}

// Bildir, sonra sonuç kesinleşene kadar (en çok ~100 sn) bekle. ilerle(sonuc) ara durumları alır.
export async function sonucuBildirVeBekle({ odaId, macNo, kazanan, rakipAyrildi, ilerle, iptal = { iptal: false }, aralikMs = 2500, enFazlaMs = 100000 }) {
  let s = await macSonucuBildir({ odaId, macNo, kazanan, rakipAyrildi });
  if (!s) s = await macDurumu(odaId, macNo);
  const bas = Date.now();
  while (s && s.durum === "bekliyor" && !iptal.iptal && Date.now() - bas < enFazlaMs) {
    ilerle && ilerle(s);
    await new Promise((r) => setTimeout(r, aralikMs));
    if (iptal.iptal) break;
    s = await macDurumu(odaId, macNo);
  }
  if (s && s.durum === "islendi") derecemiGetir();
  return s;
}

// ---------------------------------------------------------------- liderlik / rakip
export async function liderlik(tur = "tum", limit = 50) {
  try {
    await oturumKimligi();
    // Paket 38: liderlik2 oyuncu kimliğini de döndürür (satırdan bildir/engelle).
    // SQL henüz çalıştırılmadıysa eski liderlik'e düş.
    const yeni = await supabase.rpc("liderlik2", { p_tur: tur, p_limit: limit });
    if (!yeni.error && Array.isArray(yeni.data)) return { hata: false, satirlar: yeni.data };
    const { data, error } = await supabase.rpc("liderlik", { p_tur: tur, p_limit: limit });
    if (error) return { hata: true, satirlar: [] };
    return { hata: false, satirlar: data || [] };
  } catch (e) {
    return { hata: true, satirlar: [] };
  }
}

export async function rakipKarti(oyuncuId) {
  if (!oyuncuId) return null;
  try {
    const { data, error } = await supabase.rpc("derece_oyuncu", { p_oyuncu: oyuncuId });
    if (error) return null;
    return data || null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- hesaba taşıma
// E-posta ile giriş/kayıt ÖNCESİ: anonim oturumdaki kartın devir jetonunu sakla.
export async function deviriHazirla() {
  try {
    if (!(await anonimOturumMu())) return null;
    const { data } = await supabase.rpc("derece_benim");
    if (!data || data.durum !== "tamam" || !(data.mac > 0)) return null;
    const devir = { eski: data.oyuncu, jeton: data.devir_jetonu };
    await AsyncStorage.setItem(DEVIR, JSON.stringify(devir));
    return devir;
  } catch (e) {
    return null;
  }
}

// Giriş/kayıt SONRASI: saklanan kartı yeni hesaba taşı (hesapta derece yoksa).
export async function deviriTamamla() {
  try {
    const s = await AsyncStorage.getItem(DEVIR);
    if (!s) return null;
    const { eski, jeton } = JSON.parse(s);
    const { data, error } = await supabase.rpc("derece_devral", { p_eski: eski, p_jeton: jeton });
    if (!error) await AsyncStorage.removeItem(DEVIR);
    _son = null;
    try { await AsyncStorage.removeItem(ONBELLEK); } catch (e) {}
    derecemiGetir();
    return data || null;
  } catch (e) {
    return null;
  }
}

// Oturum kapanınca (çıkış) eski kartı göstermeyelim.
export async function dereceOnbelleginiTemizle() {
  _son = null;
  try { await AsyncStorage.removeItem(ONBELLEK); } catch (e) {}
}
