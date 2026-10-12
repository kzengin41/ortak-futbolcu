import React, { useState } from "react";
import { ImageBackground, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, Path } from "react-native-svg";
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

// Temanın renklerinden çizilen saha. genislik/yukseklik verilmezse ekran boyu.
export function SahaDeseni({ genislik, yukseklik, cizgiKalinligi = 1.5 }) {
  const ekran = useWindowDimensions();
  const w = genislik || ekran.width;
  const h = yukseklik || Math.max(ekran.height, 1);
  const serit = 10;                       // biçilmiş çim: yatay bantlar
  const sh = h / serit;
  const cizgi = saydam(COLORS.text, 0.11);
  // ceza sahası (alt): kutu, küçük kutu, yay
  const kutuUst = h - h * 0.17;
  const kx1 = w * 0.17, kx2 = w * 0.83;
  const yayR = w * 0.17, yayMy = h - h * 0.115;
  const dy = kutuUst - yayMy;                         // yay merkezi kutunun içinde: yalnız dışarı taşan kısım
  const dx = Math.sqrt(Math.max(0, yayR * yayR - dy * dy));
  const merkezR = w * 0.27;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="isik" cx={w / 2} cy={-h * 0.05} r={Math.max(w, h) * 0.75} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={COLORS.accent} stopOpacity={0.22} />
          <Stop offset="0.45" stopColor={COLORS.accent} stopOpacity={0.07} />
          <Stop offset="1" stopColor={COLORS.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={COLORS.bg} />
      {Array.from({ length: serit }).map((_, i) => (i % 2 === 0 ? (
        <Rect key={i} x={0} y={i * sh} width={w} height={sh} fill={COLORS.text} fillOpacity={0.03} />
      ) : null))}
      <Rect x={0} y={0} width={w} height={h} fill="url(#isik)" />
      <Circle cx={w / 2} cy={0} r={merkezR} stroke={cizgi} strokeWidth={cizgiKalinligi} fill="none" />
      <Circle cx={w / 2} cy={0} r={3} fill={cizgi} />
      <Path d={`M${kx1} ${h + 2} V${kutuUst} H${kx2} V${h + 2}`} stroke={cizgi} strokeWidth={cizgiKalinligi} fill="none" />
      <Path d={`M${w * 0.35} ${h + 2} V${h - h * 0.065} H${w * 0.65} V${h + 2}`} stroke={cizgi} strokeWidth={cizgiKalinligi} fill="none" />
      {dx > 0 ? <Path d={`M${w / 2 - dx} ${kutuUst} A${yayR} ${yayR} 0 0 1 ${w / 2 + dx} ${kutuUst}`} stroke={cizgi} strokeWidth={cizgiKalinligi} fill="none" /> : null}
      <Circle cx={w / 2} cy={yayMy} r={2.5} fill={cizgi} />
    </Svg>
  );
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
