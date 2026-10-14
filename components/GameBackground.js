import React, { useState } from "react";
import { ImageBackground, StyleSheet, View, useWindowDimensions } from "react-native";
import { ArkaplanDeseni } from "./FormaDeseni";
import { LinearGradient } from "expo-linear-gradient";
import { KlavyeAlani, KlavyeScroll } from "./Klavye";
import { useAltBosluk } from "../lib/altBosluk";
import { useSoundSettings } from "../lib/SettingsContext";
import { COLORS, paletBul, saydam } from "../lib/theme";

// ============================================================================
// Paket 25 (12 Ekim 2026, Kerem: "tema ve arkaplan konusu hala problemli.
// beşiktaş açtım, full toz bulutu gibi, gri bir alan. herhangi bir temada
// arkaplan ile kontrast yok, uyum da sağlanmamış.")
// KÖK NEDEN: takım arkaplanları (saha_gs/fb/bjk/ts/notr.jpg) çim FOTOĞRAFININ
// boyanmış hâliydi: piksel piksel gren (standart sapma ~24) + kartlarla aynı
// parlaklık bandı. Üstüne zemin renginde örtü binince gri, tozlu bir yüzey
// oluyor, kartlar o yüzeyden ayrışmıyordu; renkler de temadan değil resimden
// geliyordu.
// ÇÖZÜM: "Temaya uygun" arkaplan artık RESİM DEĞİL, temanın kendi renklerinden
// ÇİZİLEN bir saha deseni (SahaDeseni, react-native-svg):
//   • zemin (COLORS.bg) — kartlardan belirgin koyu (kart/zemin kontrastı 1.42)
//   • üstte vurgu renginde yumuşak bir ışık (stadyum projektörü), aşağı söner
//   • çok hafif biçilmiş çim şeritleri (yatay düz bantlar, gren YOK)
//   • ince saha çizgileri: üstte orta yuvarlak, altta ceza sahası
// Hepsi temadan türediği için her temada uyumlu; gren olmadığı için temiz.
// Seçenekler: Temaya uygun (desen) · Çim fotoğrafı · Düz renk. Takım
// fotoğrafları kaldırıldı (eski kayıtlı seçimler "Temaya uygun"a düşer).
// ============================================================================
export const ARKAPLANLAR = {
  saha: require("../assets/backgrounds/grass_bg.jpg"),
};
export const ORTU = [0.38, 0.7, 0.9];   // çim fotoğrafı üstündeki zemin rengi örtüsü (üst, orta, alt)
export const ARKAPLAN_SECENEKLERI = [
  { id: "tema", ad: "Temaya uygun" },
  { id: "saha", ad: "Çim fotoğrafı" },
  { id: "duz", ad: "Düz renk" },
];

export function arkaplanAnahtari(themeId, secim) {
  if (secim === "saha" || secim === "duz") return secim;
  const a = paletBul(themeId || "cim").arka;
  return a === "saha" || a === "duz" ? a : "desen";
}

// Temanın renklerinden çizilen arkaplan. genislik/yukseklik verilmezse ekran boyu.
// Paket 30 — "Forma" sistemi: çizim components/FormaDeseni.js ArkaplanDeseni'nde
// (kulüp renginde stadyum ışığı + forma motifi + ince saha çizgileri). Ad geriye
// uyum için duruyor (Ayarlar önizlemesi bunu çağırıyor).
export function SahaDeseni({ genislik, yukseklik, cizgiKalinligi = 1.4 }) {
  const ekran = useWindowDimensions();
  return <ArkaplanDeseni genislik={genislik || ekran.width} yukseklik={yukseklik || Math.max(ekran.height, 1)} cizgiKalinligi={cizgiKalinligi} />;
}

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
  const { settings } = useSoundSettings();
  const anahtar = arkaplanAnahtari(settings && settings.themeId, settings && settings.arkaplan);
  const bg = COLORS.bg;
  // Desen kabın GERÇEK boyutuna çizilir (sekme çubuklu ekranlarda ceza sahası
  // çubuğun altında kalmasın); ölçülene kadar düz zemin rengi.
  const [boyut, setBoyut] = useState(null);
  const olc = (e) => {
    const { width, height } = e.nativeEvent.layout;
    if (!boyut || Math.abs(boyut.w - width) > 1 || Math.abs(boyut.h - height) > 1) setBoyut({ w: width, h: height });
  };
  return (
    <ImageBackground
      source={anahtar === "saha" ? ARKAPLANLAR.saha : null}
      style={[styles.background, { backgroundColor: bg }]}
      resizeMode="cover"
      onLayout={anahtar === "desen" ? olc : undefined}
    >
      {anahtar === "desen" && boyut ? <SahaDeseni genislik={boyut.w} yukseklik={boyut.h} /> : null}
      {/* Çim fotoğrafı seçiliyse: fotoğraf zemin renginde örtüyle koyulaşır
          (31 Ağustos'tan beri; Paket 22'de 0.38/0.70/0.90). */}
      {anahtar === "saha" ? (
        <LinearGradient
          colors={[saydam(bg, ORTU[0]), saydam(bg, ORTU[1]), saydam(bg, ORTU[2])]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
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
    overflow: "hidden",
  },
  forceTransparent: {
    backgroundColor: "transparent",
  },
});
