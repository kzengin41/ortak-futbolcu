// ============================================================================
// DİL DESTEĞİ — Paket 39 (20 Ekim 2026)
// Kerem: "uygulamaya dil seçeneği getirmeyi de planlayalım."
//
// NASIL ÇALIŞIR
// • Koddaki her arayüz metni _t("Türkçe metin") içinde. Türkçe metnin KENDİSİ
//   anahtar: Türkçe seçiliyken _t metni olduğu gibi döndürür (yani Türkçe
//   kullanıcı için HİÇBİR ŞEY değişmez); İngilizce seçiliyken lib/ceviri/en.json
//   sözlüğündeki karşılığı döner. Karşılık yoksa yine Türkçe görünür (çökmez).
// • Değişken içeren metinler: _t("{0} puan", [puan]) → "{0}" yerine puan.
// • Dil, uygulama AÇILIRKEN bir kez belirlenir (index.js, temayla aynı yerde):
//   ekranların modül düzeyindeki sabitleri (mod adları, rehberler…) de doğru
//   dilde oluşsun diye. Dil değişince uygulama yeniden yüklenir (temadaki gibi).
// • İlk kurulumda telefonun dili Türkçe değilse İngilizce açılır. Uygulamayı
//   zaten kullanan biri için (ayarı kayıtlı) varsayılan Türkçe kalır —
//   telefonu İngilizce olan mevcut kullanıcı güncellemeyle şaşırmasın.
// ============================================================================
import { NativeModules, Platform } from "react-native";

export const DILLER = [
  { id: "tr", ad: "Türkçe", bayrak: "🇹🇷" },
  { id: "en", ad: "English", bayrak: "🇬🇧" },
];

let _dil = "tr";
let _sozluk = null;

function sozlukYukle(d) {
  if (d === "en") {
    try {
      const s = require("./ceviri/en.json");
      return (s && s.default) || s || {};
    } catch (e) {
      return {};
    }
  }
  return null;
}

export function diliAyarla(d) {
  _dil = d === "en" ? "en" : "tr";
  _sozluk = sozlukYukle(_dil);
  return _dil;
}

export function dil() {
  return _dil;
}

export function ingilizceMi() {
  return _dil === "en";
}

// Telefonun dili (yerel paket gerekmeden): Intl → iOS SettingsManager → Android I18nManager.
export function cihazDili() {
  let kod = "";
  try {
    kod = Intl.DateTimeFormat().resolvedOptions().locale || "";
  } catch (e) {}
  if (!kod) {
    try {
      if (Platform.OS === "ios") {
        const s = NativeModules.SettingsManager && NativeModules.SettingsManager.settings;
        kod = (s && (s.AppleLocale || (s.AppleLanguages && s.AppleLanguages[0]))) || "";
      } else {
        const i = NativeModules.I18nManager;
        kod = (i && (i.localeIdentifier || (i.getConstants && i.getConstants().localeIdentifier))) || "";
      }
    } catch (e) {}
  }
  return String(kod || "tr").toLowerCase().startsWith("tr") ? "tr" : "en";
}

// Açılışta (index.js): kayıtlı ayar varsa o; yoksa mevcut kullanıcı Türkçe, yeni kurulum telefonun dili.
export function baslangicDili(ayarlar) {
  if (ayarlar && (ayarlar.dil === "tr" || ayarlar.dil === "en")) return ayarlar.dil;
  if (ayarlar && Object.keys(ayarlar).length) return "tr";
  return cihazDili();
}

export function _t(metin, degerler) {
  let s = (_sozluk && typeof metin === "string" && _sozluk[metin]) || metin;
  if (degerler && typeof s === "string") {
    s = s.replace(/\{(\d+)\}/g, (m, i) => {
      const v = degerler[Number(i)];
      return v == null ? "" : String(v);
    });
  }
  return s;
}

// Sayı / tarih biçimi: Türkçede 8.500, İngilizcede 8,500.
export function yerel() {
  return _dil === "en" ? "en-US" : "tr-TR";
}

export function sayiYaz(n) {
  return Math.round(Number(n) || 0).toLocaleString(yerel());
}

// Ses tanıma dili.
export function sesDili() {
  return _dil === "en" ? "en-US" : "tr-TR";
}
