import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_PRESET_ID } from "./leaguePresets";

const STORAGE_KEY = "ortak-futbolcu-sound-settings";

// 31 Ağustos 2026 (Faz 3) — Kerem: "kapsam ön ayarları gibi bir şey olsa,
// kişi diyelim ki şampiyonlar ligi güncel seçti, girdiği her modda kapsam
// default olarak bu gelse, canı isteyince değiştirse." Ayrı bir context
// açmak yerine mevcut ses ayarları context'ine ekledik (tek AsyncStorage
// anahtarı, tek Provider) — isim "SettingsContext" zaten genel.
const DEFAULTS = {
  background: 1.0,
  correctWrong: 1.0,
  click: 1.0,
  whistle: 1.0,
  defaultLeaguePresetId: DEFAULT_PRESET_ID,
  // 25 Eylul 2026 (Kerem: "kullanmak istemeyenler icin bu ayar
  // kapatilabilsin") — sesli cevapta onay adimi. Varsayilan ACIK: yanlis
  // anlasilan bir cevabin turu kaybettirmesi, bir dokunus fazladan onaydan
  // daha kotu. Kapatan kullanici eski (dogrudan gonder) davranisini alir.
  voiceConfirm: true,

  // 26 Eylül 2026 — tema seçimi (bkz. lib/theme.js PALETLER).
  // themeId burada durur ama UYGULANDIĞI yer index.js: renkler ekran
  // modülleri yüklenmeden önce yerleştirilmek zorunda. Bu yüzden tema
  // değişikliği uygulama yeniden açıldığında görünür.
  themeId: "cim",
  customAccent: null,
  customAccentDark: null,
  customCta: null,
  customCtaDark: null,
};

// 4 Ekim 2026 — React dışındaki modüllerin (lib/bilgiSeviyesi.js: oyunda
// ince ayar) ayar okuyup yazabilmesi için. Provider her render'da bunları
// günceller; uygulamada tek Provider var.
let _disYazici = null;
let _sonAyarlar = DEFAULTS;
export function ayarYaz(key, value) {
  return _disYazici ? _disYazici(key, value) : Promise.resolve();
}
export function guncelAyarlar() {
  return _sonAyarlar;
}

const SettingsContext = createContext({ settings: DEFAULTS, setSetting: () => {}, loaded: false });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) { try { setSettings((prev) => ({ ...prev, ...JSON.parse(raw) })); } catch {} }
      })
      .finally(() => setLoaded(true));
  }, []);

  // 26 Eylül 2026 — artık AsyncStorage yazma SÖZÜNÜ (promise) döndürüyor.
  // Sebebi tema: uygulamayı yeniden yükleyerek temayı uygulayacağız, ama
  // yeniden yükleme yazma bitmeden olursa seçim KAYBOLUR. Çağıran taraf
  // `await setSetting(...)` diyip yazmanın bittiğinden emin olabiliyor.
  // Beklemek istemeyen çağıranlar için davranış aynı (dönüşü yok sayabilir).
  function setSetting(key, value) {
    let yazma = Promise.resolve();
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      yazma = AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    // setSettings güncelleyicisi senkron çalıştığı için `yazma` bu noktada
    // gerçek söze bağlanmış oluyor.
    return yazma;
  }

  _disYazici = setSetting;
  _sonAyarlar = settings;

  return <SettingsContext.Provider value={{ settings, setSetting, loaded }}>{children}</SettingsContext.Provider>;
}

export function useSoundSettings() {
  return useContext(SettingsContext);
}

// Aynı context'in daha genel bir adı — kapsam ön ayarı gibi ses dışı
// ayarlar da buradan okunuyor, yeni kullanım yerlerinde bu isim daha açık.
export const useAppSettings = useSoundSettings;
