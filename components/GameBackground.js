import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import backgrounds from "../assets/backgrounds";
import { KlavyeAlani, KlavyeScroll } from "./Klavye";
import { useAltBosluk } from "../lib/altBosluk";

const randomBg = backgrounds.length > 0
  ? backgrounds[Math.floor(Math.random() * backgrounds.length)]
  : require("../assets/grass_bg.jpg");

// 4 Eylül 2026 (Kerem: "neden arkaplan, kapat butonu vs en sağa kadar
// gitmiyor?") — GERÇEK KÖK NEDEN BULUNDU (bir önceki turdaki SafeAreaView
// edges teorisi YETERSİZDİ, düzeltmedi). Her ekran `styles.container`'ı
// (içinde `padding: 20` var) doğrudan bu component'in `style` prop'una
// veriyordu, ve o style DOĞRUDAN ImageBackground'ın kendisine
// uygulanıyordu. React Native/Yoga'da `padding`, absolute-positioned
// çocukların (Image'in kendisi ve aşağıdaki LinearGradient — ikisi de
// `StyleSheet.absoluteFillObject`/tam kaplama kullanıyor) konumlanma
// referansını PADDING KUTUSUNA kaydırıyor — yani resim/gradyan artık
// gerçek ekran kenarına değil, "padding kadar İÇERİDE" bir kutuya
// oturuyordu. Sonuç: arkaplan görselinin dışında container'ın DÜZ RENGİ
// (backgroundColor) ince bir şerit olarak görünüyordu — hem sağda hem
// solda hem üstte hem altta, ekranın HER YERİNDE, App.js'teki
// SafeAreaView'den TAMAMEN BAĞIMSIZ bir sorun.
// ÇÖZÜM: dışarıdan gelen `style` artık ImageBackground'a DEĞİL, resmin
// ÜSTÜNDEKİ bir iç içerik View'ına uygulanıyor — böylece padding SADECE
// içerik (children) düzenini etkiliyor, resim/gradyan HER ZAMAN tam ekran
// kaplıyor. İç View'ın backgroundColor'ı bilinçli olarak "transparent"a
// zorlanıyor (çağıran ekranların styles.container'ındaki backgroundColor
// resmi KAPATMASIN diye — o renk zaten sadece resim yokken bir fallback'ti).
// 4 Ekim 2026 — `klavye="kaydir"`: ScrollView'i olmayan oyun ekranlarında
// içerik kaydırılabilir bir alana alınır ve klavye açılınca cevap kutusu ile
// öneriler klavyenin üstünde kalır (bkz. components/Klavye.js).
// `klavye="pay"`: yalnızca klavye kadar alt boşluk (ekranın kendi listesi
// zaten küçülebiliyorsa).
function kaydirmaStili(style) {
  const duz = StyleSheet.flatten(style) || {};
  // ScrollView içeriğinde flex:1 kaydırmayı öldürür; yerine flexGrow:1.
  const { flex, backgroundColor, ...kalan } = duz;
  return [{ flexGrow: 1 }, kalan];
}

// 5 Ekim 2026 — Android gezinme çubuğu içeriğin üstüne binmesin: alt kenara
// cihazın gerçek alt boşluğu eklenir (lib/altBosluk.js; sekme ekranlarında 0).
function altPayli(style, alt) {
  if (!alt) return style;
  const duz = StyleSheet.flatten(style) || {};
  const mevcut = duz.paddingBottom ?? duz.paddingVertical ?? duz.padding ?? 0;
  return [style, { paddingBottom: mevcut + alt }];
}

export default function GameBackground({ children, style, klavye }) {
  const alt = useAltBosluk();
  return (
    <ImageBackground
      source={randomBg}
      style={styles.background}
      resizeMode="cover"
    >
      {/* 31 Ağustos 2026 (Kerem: "UI aşırı yeşil, mide bulandırıyor") — eski
          gradyan çim fotoğrafını neredeyse saf/parlak yeşile boyuyordu,
          üzerine binen kartlar da yeşil olunca ekranın HER YERİ yeşil oluyordu.
          Yeni gradyan: sahayı hâlâ görebiliyorsun (kimlik/atmosfer için —
          "futbol sahası zemini" isteği) ama üstü lacivert/gece stadyumu
          tonuna doğru KOYULAŞTIRILIYOR, böylece üstteki kartlar/metinler artık
          yeşil değil lacivert+altın paletiyle net şekilde ayrışıyor. */}
      <LinearGradient
        colors={["rgba(8, 24, 18, 0.55)", "rgba(8, 16, 24, 0.88)", "rgba(6, 12, 20, 0.97)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      {klavye === "kaydir" ? (
        <KlavyeAlani>
          <KlavyeScroll style={{ flex: 1 }} contentContainerStyle={altPayli(kaydirmaStili(style), alt)} showsVerticalScrollIndicator={false}>
            {children}
          </KlavyeScroll>
        </KlavyeAlani>
      ) : klavye === "pay" ? (
        <KlavyeAlani style={[altPayli(style, alt), styles.forceTransparent]}>{children}</KlavyeAlani>
      ) : (
        <View style={[altPayli(style, alt), styles.forceTransparent]}>{children}</View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
  },
  forceTransparent: {
    backgroundColor: "transparent",
  },
});
