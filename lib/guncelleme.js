// ============================================================================
// GÜNCELLEME (OTA) YÖNETİCİSİ — 5 Ekim 2026 (Kerem: "telefonda update olmamış")
//
// Şimdiye kadar expo-updates kendi hâline bırakılmıştı: açılışta arka planda
// indirir, ancak İKİNCİ açılışta uygular. Uygulama arka planda açık kaldığı
// sürece (Android çoğu zaman kapatmaz) yeni sürüm hiç devreye girmiyordu ve
// gelip gelmediğini görmenin de yolu yoktu. Artık:
//   1) Açılışta (ve uygulama arka plandan her döndüğünde) güncelleme denetlenir,
//      varsa indirilir; ekranın altında "Yeni sürüm hazır — Yenile" bandı çıkar.
//   2) Ayarlar → Gelişmiş → Sürüm: kanal, sürüm, çalışan güncellemenin kimliği
//      ve tarihi + "Güncellemeleri denetle" düğmesi. Bir şey gelmezse sebebi
//      buradan okunur (ör. "acil durum açılışı" = indirilen sürüm çöktü,
//      gömülü sürüme dönüldü → Sentry'ye de raporlanır).
// expo-updates yoksa (Expo Go, geliştirme) her şey sessizce devre dışı.
// ============================================================================
import { useEffect, useState } from "react";
import { AppState } from "react-native";

let U = null;
try { U = require("expo-updates"); } catch (e) { U = null; }

export function guncellemeBilgisi() {
  if (!U) return { etkin: false };
  return {
    etkin: !!U.isEnabled,
    kanal: U.channel || null,
    runtime: U.runtimeVersion || null,
    kimlik: U.updateId || null,
    gomulu: !!U.isEmbeddedLaunch,
    acil: !!U.isEmergencyLaunch,
    tarih: U.createdAt ? new Date(U.createdAt) : null,
  };
}

// Dönüş: "kapali" | "guncel" | "hazir" | "hata"
export async function guncellemeDenetle() {
  try {
    if (!U || !U.isEnabled || (typeof __DEV__ !== "undefined" && __DEV__)) return { durum: "kapali" };
    const c = await U.checkForUpdateAsync();
    if (!c || !c.isAvailable) return { durum: "guncel" };
    const f = await U.fetchUpdateAsync();
    return { durum: f && f.isNew === false ? "guncel" : "hazir" };
  } catch (e) {
    return { durum: "hata", mesaj: String((e && e.message) || e) };
  }
}

export async function yenidenBaslat() {
  try { if (U) await U.reloadAsync(); } catch (e) {}
}

let _acilRaporlandi = false;
// App.js: açılışta + öne gelişte denetler; indirilen sürüm hazırsa true döner.
export function useGuncellemeHazir() {
  const [hazir, setHazir] = useState(false);
  useEffect(() => {
    let canli = true;
    const bilgi = guncellemeBilgisi();
    if (bilgi.acil && !_acilRaporlandi) {
      _acilRaporlandi = true;
      try { require("./hataRaporu").Sentry.captureMessage("expo-updates acil durum açılışı (güncelleme çöktü, gömülü sürüme dönüldü)"); } catch (e) {}
    }
    const denetle = () => guncellemeDenetle().then((r) => { if (canli && r.durum === "hazir") setHazir(true); });
    denetle();
    const abone = AppState.addEventListener("change", (s) => { if (s === "active") denetle(); });
    return () => { canli = false; abone && abone.remove && abone.remove(); };
  }, []);
  return hazir;
}
