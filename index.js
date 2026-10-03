// UYGULAMANIN GİRİŞ NOKTASI — 26 Eylül 2026 (tema desteği için eklendi).
//
// NİYE BU DOSYA VAR:
// Ekranlar renkleri `StyleSheet.create({ ... COLORS.accent ... })` içinde
// kullanıyor ve StyleSheet.create değeri O ANDA kopyalıyor. Yani bir ekranın
// renkleri, o ekranın MODÜLÜ YÜKLENDİĞİ anda sabitleniyor. Kayıtlı temayı
// App.js'in içinde okumak çok geç olurdu: App.js'in import satırları (Oyna,
// Profilim, Ayarlar, Online ekranları, TabHeader...) daha o noktada çalışmış
// ve varsayılan renkleri kazımış olurdu.
//
// ÇÖZÜM: girişi bir adım öne almak. Bu dosya önce AsyncStorage'dan temayı
// okuyup uyguluyor, App.js'i ANCAK ONDAN SONRA require ediyor. Böylece
// 31 ekran/bileşen dosyasının HİÇBİRİ değişmeden bütün uygulama temalanıyor.
//
// Eskiden giriş `node_modules/expo/AppEntry.js` idi (package.json "main").
// Artık burası; AppEntry'nin yaptığı tek şey registerRootComponent çağırmaktı,
// o da aşağıda aynen yapılıyor.
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { registerRootComponent } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, temayiUygula } from "./lib/theme";
// Çökme raporlama (Sentry) en başta başlasın: App.js yüklenirken çıkan hatalar da
// yakalanır. (App.js de aynı modülü içe aktarıyor; modül bir kez çalışır.)
import { Sentry } from "./lib/hataRaporu";

// lib/SettingsContext.js ile AYNI anahtar — tek bir ayar deposu var.
const AYAR_ANAHTARI = "ortak-futbolcu-sound-settings";

function Kok() {
  const [App, setApp] = useState(null);
  const [hata, setHata] = useState(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const ham = await AsyncStorage.getItem(AYAR_ANAHTARI);
        if (ham) {
          const ayarlar = JSON.parse(ham) || {};
          if (ayarlar.themeId) {
            temayiUygula(ayarlar.themeId, {
              accent: ayarlar.customAccent,
              accentDark: ayarlar.customAccentDark,
              cta: ayarlar.customCta,
              ctaDark: ayarlar.customCtaDark,
              palet: ayarlar.customPalet,
            });
          }
        }
      } catch (e) {
        // Tema okunamadıysa varsayılanla devam — uygulamayı açılmaz hâle
        // getirmek, yanlış renkten çok daha kötü.
      }
      if (iptal) return;
      // App.js VE bağlı olduğu bütün ekranlar TAM BURADA yükleniyor.
      // try/catch ŞART: package.json "main" artık bu dosya. Burada yakalanmayan
      // bir hata olursa kullanıcı SİYAH BİR EKRAN görür ve hiçbir ipucu
      // olmaz — o yüzden hata ekrana yazılıyor.
      try {
        // DİKKAT — 26 Eylül 2026, bu satır bir kez yanlış yazıldı ve uygulama
        // hiç açılmadı ("Element type is invalid ... but got: <SafeAreaProvider />").
        // SEBEBİ: useState'in setter'ı FONKSİYON alırsa onu "güncelleyici"
        // (updater) sanır ve ÇAĞIRIR. `setApp(require("./App").default)` böylece
        // App bileşenini çağırıyor, dönen JSX'i state'e yazıyordu; sonra
        // <App /> bir JSX nesnesini bileşen gibi render etmeye çalışıyordu.
        // Bir fonksiyonu state'e KOYMAK için tek yol: fonksiyon döndüren bir
        // fonksiyon vermek.
        const Yuklenen = require("./App").default;
        setApp(() => Yuklenen);
      } catch (e) {
        try { Sentry.captureException(e, { tags: { kaynak: "acilis" } }); } catch {}
        setHata(String((e && e.message) || e));
      }
    })();
    return () => { iptal = true; };
  }, []);

  // Tema okunurken tek karelik boş bir zemin. Açılış görseli (splash) hâlâ
  // görünür durumda olduğu için kullanıcı bir şey fark etmiyor.
  if (hata) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: "center" }}>
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "900", marginBottom: 10 }}>
          Uygulama başlatılamadı
        </Text>
        <Text style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 19 }}>{hata}</Text>
      </View>
    );
  }
  if (!App) return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  return <App />;
}

registerRootComponent(Kok);
