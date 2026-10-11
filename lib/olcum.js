// ============================================================================
// HAFİF ÖLÇÜM — Paket 23 (11 Ekim 2026)
// Kapalı testte "kim geri geliyor, hangi modu oynuyor, online eşleşme ne kadar
// sürüyor" sorularını cevaplamak için. Supabase'deki public.olaylar tablosuna
// (yalnız ekleme izni var) küçük kayıtlar yazar; kişisel veri YOK: oyuncu =
// anonim oturum kimliği, olay adı, mod, birkaç sayı, uygulama sürümü.
// Ayarlar → Gelişmiş → "Kullanım verisi gönder" kapatılırsa hiçbir şey gitmez.
// Olaylar kuyrukta birikir, 20 sn'de bir / 15 olayda bir / uygulama arka plana
// geçince toplu gönderilir; internet yoksa sessizce kaybolur (oyunu etkilemez).
// ============================================================================
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, oturumKimligi } from "./supabaseClient";

const AYAR = "ortak-futbolcu-sound-settings";
const ARALIK_MS = 20000;
const TOPLU = 15;
const KUYRUK_SINIRI = 200;

let kuyruk = [];
let zamanlayici = null;
let surum = null;
let gonderiliyor = false;
let appStateAbone = null;

function surumBilgisi() {
  if (surum) return surum;
  try {
    const U = require("expo-updates");
    surum = `1.0.0${U && U.updateId ? "+" + String(U.updateId).slice(0, 8) : ""}`;
  } catch (e) {
    surum = "1.0.0";
  }
  return surum;
}

async function acikMi() {
  try {
    const s = await AsyncStorage.getItem(AYAR);
    if (!s) return true;
    return JSON.parse(s).olcum !== false;
  } catch (e) {
    return true;
  }
}

export async function gonder() {
  if (gonderiliyor || !kuyruk.length) return;
  gonderiliyor = true;
  const parti = kuyruk.splice(0, 50);
  try {
    if (!(await acikMi())) return;
    const oyuncu = await oturumKimligi();
    const satirlar = parti.map((o) => ({ ...o, oyuncu }));
    await supabase.from("olaylar").insert(satirlar);
  } catch (e) {
    // internet/oturum yoksa bırak: ölçüm oyunu asla bozmaz
  } finally {
    gonderiliyor = false;
  }
}

function planla() {
  if (zamanlayici) return;
  zamanlayici = setTimeout(() => { zamanlayici = null; gonder(); }, ARALIK_MS);
  if (!appStateAbone) {
    try {
      appStateAbone = AppState.addEventListener("change", (s) => { if (s !== "active") gonder(); });
    } catch (e) {}
  }
}

// olay("mod_bitti", { mod: "teamTeam", veri: { kazandi: true } })
export function olay(ad, { mod = null, veri = null } = {}) {
  try {
    if (!ad) return;
    kuyruk.push({ olay: String(ad).slice(0, 40), mod: mod ? String(mod).slice(0, 40) : null, veri: veri || null, surum: surumBilgisi(), zaman: new Date().toISOString() });
    if (kuyruk.length > KUYRUK_SINIRI) kuyruk = kuyruk.slice(-KUYRUK_SINIRI);
    if (kuyruk.length >= TOPLU) gonder();
    else planla();
  } catch (e) {}
}

// Testler için
export function __kuyruk() { return kuyruk; }
export function __sifirla() { kuyruk = []; if (zamanlayici) clearTimeout(zamanlayici); zamanlayici = null; }
