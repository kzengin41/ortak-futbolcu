import React, { useMemo, useRef } from "react";
import { Animated, PanResponder, View, Dimensions } from "react-native";

// ============================================================================
// SEKMELER ARASI KAYDIRMA — Paket 18 (5 Ekim 2026, Kerem: "uygulama
// arayüzünde iken sağa-sola çekince bir sağdaki-bir soldaki menüye geçsin")
//
// Alt menünün her sekmesi bu sarmalayıcının içinde (App.js → Tab.Navigator
// `screenLayout`). Parmak yatay çekilince içerik parmağı hafifçe izler;
// bırakınca yeterince çekildiyse (mesafe ya da hız) komşu sekmeye geçilir,
// yoksa yerine yaylanır. Geçişin kendisi Tab.Navigator'ın "shift" animasyonu.
//
// Neden yerel PanResponder (native pager değil): yeni native paket yok, alt
// menü (bottom-tabs) ve onun yükseklik bağlamı (lib/altBosluk.js) olduğu gibi
// kalıyor. Yatay kaydırılan iç öğeler (çip şeritleri, yatay listeler) önce
// davranır: sarmalayıcı yalnızca BUBBLE aşamasında, kimse almadığında devreye
// giriyor ve hareket belirgin biçimde yatay olmalı (|dx| > 2,2 × |dy|).
// ============================================================================
export const ESIK_MESAFE = 0.22;     // ekran genişliğinin oranı
export const ESIK_HIZ = 0.45;        // px/ms

export function hedefSekme(dx, vx, index, adet, genislik) {
  const ileri = dx < -genislik * ESIK_MESAFE || vx < -ESIK_HIZ;
  const geri = dx > genislik * ESIK_MESAFE || vx > ESIK_HIZ;
  if (ileri && index < adet - 1) return index + 1;
  if (geri && index > 0) return index - 1;
  return null;
}

export default function SekmeKaydirma({ navigation, route, children }) {
  const kayma = useRef(new Animated.Value(0)).current;
  const navRef = useRef(navigation);
  navRef.current = navigation;
  const routeRef = useRef(route);
  routeRef.current = route;

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
    onPanResponderMove: (_, g) => {
      const durum = navRef.current?.getState?.();
      const i = durum ? durum.routes.findIndex((r) => r.key === routeRef.current?.key) : -1;
      const uc = (i <= 0 && g.dx > 0) || (durum && i >= durum.routes.length - 1 && g.dx < 0);
      kayma.setValue(g.dx * (uc ? 0.12 : 0.35));   // uçta (ilk/son sekme) daha sert direnç
    },
    onPanResponderRelease: (_, g) => {
      const durum = navRef.current?.getState?.();
      const genislik = Dimensions.get("window").width;
      const i = durum ? durum.routes.findIndex((r) => r.key === routeRef.current?.key) : -1;
      const hedef = durum && i >= 0 ? hedefSekme(g.dx, g.vx, i, durum.routes.length, genislik) : null;
      if (hedef != null) {
        kayma.setValue(0);
        navRef.current.navigate(durum.routes[hedef].name);
      } else {
        Animated.spring(kayma, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(kayma, { toValue: 0, useNativeDriver: true, friction: 7, tension: 80 }).start();
    },
    onPanResponderTerminationRequest: () => true,
  }), [kayma]);

  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: kayma }] }}>{children}</Animated.View>
    </View>
  );
}
