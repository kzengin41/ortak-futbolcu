// ============================================================================
// BİLDİR / ENGELLE + RAKİP METNİ SÜZGECİ — Paket 38 (20 Ekim 2026)
//
// App Store kural 1.2: kullanıcıların birbirini gördüğü uygulamada oyuncuyu
// bildirme ve engelleme olmalı. Sunucu tarafı: supabase/paket38_guvenlik.sql.
//   • oyuncuBildir  — sebep: ad | davranis | hile | diger
//   • oyuncuEngelle — engellenenle bir daha eşleşilmez (iki yönde de)
//   • engelKimlikleri — eşleşmede kaçınılacak kimlikler (önbellekli)
// SQL henüz çalıştırılmadıysa hepsi sessizce "hata" döner; oyun bozulmaz.
//
// rakipMetni: rakibin yazdığı YANLIŞ tahmin ekranda gösterilirken ham metin
// yerine tanınan futbolcunun adı gösterilir; futbolcuya benzemiyorsa hiç
// gösterilmez ("tanınmayan bir isim"). Böylece biri tahmin kutusuna hakaret
// yazıp rakibin ekranına düşüremez.
// ============================================================================
import { _t } from "./dil";
import { supabase, oturumKimligi } from "./supabaseClient";
import { findMatchedPlayer } from "./gameEngine";
import { PLAYERS } from "./players";

export const BILDIRIM_SEBEPLERI = [
  { id: "ad", etiket: _t("Uygunsuz takma ad"), ikon: "text-outline" },
  { id: "davranis", etiket: _t("Kötü davranış / hakaret"), ikon: "chatbox-ellipses-outline" },
  { id: "hile", etiket: _t("Hile şüphesi"), ikon: "warning-outline" },
  { id: "diger", etiket: _t("Diğer"), ikon: "ellipsis-horizontal" },
];

let _engeller = null;          // Set<string> | null
let _engelZamani = 0;
const ENGEL_ONBELLEK_MS = 60 * 1000;

export async function oyuncuBildir(oyuncuId, sebep, { aciklama = null, baglam = null } = {}) {
  if (!oyuncuId) return { durum: "gecersiz" };
  try {
    await oturumKimligi();
    const { data, error } = await supabase.rpc("oyuncu_bildir", {
      p_oyuncu: oyuncuId, p_sebep: sebep, p_aciklama: aciklama, p_baglam: baglam,
    });
    if (error) return { durum: "hata" };
    return data || { durum: "hata" };
  } catch (e) {
    return { durum: "hata" };
  }
}

export async function oyuncuEngelle(oyuncuId, engelle = true) {
  if (!oyuncuId) return { durum: "gecersiz" };
  try {
    await oturumKimligi();
    const { data, error } = await supabase.rpc("oyuncu_engelle", { p_oyuncu: oyuncuId, p_engelle: !!engelle });
    if (error) return { durum: "hata" };
    if (data && data.durum === "tamam") {
      if (_engeller) { if (engelle) _engeller.add(oyuncuId); else _engeller.delete(oyuncuId); }
      else _engelZamani = 0;
    }
    return data || { durum: "hata" };
  } catch (e) {
    return { durum: "hata" };
  }
}

// Eşleşmede kaçınılacak kimlikler (benim engellediklerim + beni engelleyenler).
export async function engelKimlikleri({ tazele = false, simdi = Date.now() } = {}) {
  if (!tazele && _engeller && simdi - _engelZamani < ENGEL_ONBELLEK_MS) return _engeller;
  try {
    await oturumKimligi();
    const { data, error } = await supabase.rpc("engel_kimlikleri");
    if (error) return _engeller || new Set();
    _engeller = new Set((data || []).map((x) => (typeof x === "string" ? x : x && (x.engel_kimlikleri || x.id))).filter(Boolean));
    _engelZamani = simdi;
    return _engeller;
  } catch (e) {
    return _engeller || new Set();
  }
}

export async function engellediklerim() {
  try {
    await oturumKimligi();
    const { data, error } = await supabase.rpc("engellediklerim");
    if (error) return { hata: true, liste: [] };
    return { hata: false, liste: data || [] };
  } catch (e) {
    return { hata: true, liste: [] };
  }
}

// Test için önbelleği sıfırla.
export function _engelOnbellekSifirla() { _engeller = null; _engelZamani = 0; }

// ---------------------------------------------------------------- rakip metni
const _bellek = new Map();
export function rakipMetni(metin, oyuncular = PLAYERS) {
  const t = String(metin || "").trim().slice(0, 60);
  if (!t) return null;
  if (_bellek.has(t)) return _bellek.get(t);
  let ad = null;
  try {
    const o = findMatchedPlayer(t, oyuncular);
    ad = o && o.name ? o.name : null;
  } catch (e) {
    ad = null;
  }
  if (_bellek.size > 300) _bellek.clear();
  _bellek.set(t, ad);
  return ad;
}

export function rakipMetniYaz(metin, yedek = _t("tanınmayan bir isim")) {
  return rakipMetni(metin) || yedek;
}
