// ============================================================================
// ALT BOŞLUK — 5 Ekim 2026 (Kerem: "benim android'de navigasyon düğmelerim
// açık. bazı içerikler navigasyon düğmesinin altında kalıyor. bunu otomatik
// ayarlatabiliyor muyuz?")
// Android 15+ (ve Expo SDK 54+) uygulamaları kenardan kenara çiziyor; alttaki
// geri/ana sayfa düğmeleri (ya da hareket çubuğu) içeriğin ÜSTÜNE biniyor.
// Kök SafeAreaView yalnızca üst kenarı koruyordu. Bu kanca, cihazın gerçek alt
// boşluğunu (insets.bottom: 3 düğmeli çubukta ~48 dp, hareketle gezinmede
// ~16–24 dp, düğmesiz cihazda 0) verir. Alt sekme çubuğunun içindeki ekranlarda
// 0 döner: orada boşluğu sekme çubuğu zaten bırakıyor (çift boşluk olmasın).
// ============================================================================
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";

export function useAltBosluk() {
  const insets = useSafeAreaInsets();
  const sekmeYuksekligi = useContext(BottomTabBarHeightContext);
  if (sekmeYuksekligi !== undefined) return 0;
  return Math.max(0, Math.round((insets && insets.bottom) || 0));
}
