import { useEkran } from "../lib/ekran";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, View, StyleSheet, useWindowDimensions, Easing } from "react-native";
import { createNavigatorFactory, useNavigationBuilder, TabRouter } from "@react-navigation/native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../lib/theme";
import { hedefSekme } from "./SekmeKaydirma";

// ============================================================================
// KAYDIRMALI SEKMELER — Paket 36 (15 Ekim 2026)
// Kerem: "kaydırırken beyaz ekran çıkıyor, diğer sayfanın ön izlemesi gelmesi
// lazım."
// ESKİ (Paket 18, components/SekmeKaydirma.js): alt menünün (bottom-tabs) her
// sekmesi parmakla birlikte %35 oranında kayıyordu; arkasında HİÇBİR ŞEY yoktu
// (komşu sekme o an çizilmiyordu) → açılan boşluk beyaz görünüyordu. Bırakınca
// komşu sekme ayrıca "shift" animasyonuyla geliyordu (iki ayrı hareket).
// YENİ: sekmeler yan yana dizili bir şerit (telefonun ana ekranı / Instagram
// sekmeleri gibi): parmak sayfayı BİRE BİR taşır, komşu sayfa yanından gerçekten
// görünür; bırakınca yerine oturur. Alt menüye dokununca da aynı şerit kayar.
// Native paket gerekmez (react-native-pager-view yok) — React Navigation'ın
// kendi TabRouter'ı ile özel bir navigator; navigation API'si (navigate,
// useFocusEffect, tabPress) bottom-tabs ile aynı.
//
// Açık tutulan sayfalar: şimdiye kadar açılmış olanlar + şu ankinin iki komşusu
// (önizleme için). Komşular açılıştan kısa süre sonra bağlanır, ilk açılış
// yavaşlamasın. Uçlarda (ilk/son sekme) sert direnç, boşluk tema zemininde.
// ============================================================================
const KOMSU_GECIKME_MS = 700;

function KaydirmaliSekmeNavigator({ id, initialRouteName, children, layout, screenListeners, screenOptions, screenLayout, backBehavior = "firstRoute", tabBar, UNSTABLE_router, ...rest }) {
  const { state, navigation, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, {
    id, initialRouteName, children, layout, screenListeners, screenOptions, screenLayout, backBehavior, UNSTABLE_router,
  });
  const { width: W } = useEkran();
  const insets = useSafeAreaInsets();
  const [cubukYuksekligi, setCubukYuksekligi] = useState(0);
  const index = state.index;
  const adet = state.routes.length;

  // --- hangi sayfalar çizilsin ------------------------------------------------
  const [acilmis, setAcilmis] = useState(() => new Set([state.routes[index].key]));
  const [komsularHazir, setKomsularHazir] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setKomsularHazir(true), KOMSU_GECIKME_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const k = state.routes[index].key;
    setAcilmis((s) => (s.has(k) ? s : new Set([...s, k])));
  }, [index, state.routes]);

  // --- şerit konumu ------------------------------------------------------------
  const konum = useRef(new Animated.Value(-index * W)).current;
  const durumRef = useRef({ index, W, adet });
  durumRef.current = { index, W, adet };
  const ilk = useRef(true);
  useEffect(() => {
    if (ilk.current) { ilk.current = false; konum.setValue(-index * W); return; }
    Animated.timing(konum, { toValue: -index * W, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [index, W]);

  const navRef = useRef(navigation);
  navRef.current = navigation;
  const routesRef = useRef(state.routes);
  routesRef.current = state.routes;

  const pan = useMemo(() => PanResponder.create({
    // Yatay kaydırılan iç öğeler (çip şeritleri) önce davranır: yalnız BUBBLE
    // aşamasında ve hareket belirgin biçimde yatayken.
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
    onPanResponderGrant: () => { konum.stopAnimation(); },
    onPanResponderMove: (_, g) => {
      const { index: i, W: w, adet: n } = durumRef.current;
      const uc = (i <= 0 && g.dx > 0) || (i >= n - 1 && g.dx < 0);
      konum.setValue(-i * w + g.dx * (uc ? 0.18 : 1));
    },
    onPanResponderRelease: (_, g) => {
      const { index: i, W: w, adet: n } = durumRef.current;
      const hedef = hedefSekme(g.dx, g.vx, i, n, w);
      if (hedef != null) {
        const r = routesRef.current[hedef];
        navRef.current.navigate(r.name);   // index değişince şerit yerine oturur (yukarıdaki efekt)
      } else {
        Animated.spring(konum, { toValue: -i * w, useNativeDriver: true, friction: 8, tension: 90 }).start();
      }
    },
    onPanResponderTerminate: () => {
      const { index: i, W: w } = durumRef.current;
      Animated.spring(konum, { toValue: -i * w, useNativeDriver: true, friction: 8, tension: 90 }).start();
    },
    onPanResponderTerminationRequest: () => true,
  }), [konum]);

  const cubuk = tabBar ? tabBar({ state, descriptors, navigation, insets }) : null;

  return (
    <NavigationContent>
      <View style={s.kap}>
        <BottomTabBarHeightContext.Provider value={cubukYuksekligi || 1}>
          <View style={s.sahne} {...pan.panHandlers}>
            <Animated.View style={[s.serit, { width: W * adet, transform: [{ translateX: konum }] }]}>
              {state.routes.map((route, i) => {
                const odak = i === index;
                const ciz = acilmis.has(route.key) || (komsularHazir && Math.abs(i - index) === 1);
                return (
                  <View
                    key={route.key}
                    style={[s.sayfa, { width: W }]}
                    pointerEvents={odak ? "auto" : "none"}
                    importantForAccessibility={odak ? "auto" : "no-hide-descendants"}
                    accessibilityElementsHidden={!odak}
                  >
                    {ciz ? descriptors[route.key].render() : null}
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </BottomTabBarHeightContext.Provider>
        <View onLayout={(e) => setCubukYuksekligi(Math.round(e.nativeEvent.layout.height))}>{cubuk}</View>
      </View>
    </NavigationContent>
  );
}

export const createKaydirmaliSekmeler = createNavigatorFactory(KaydirmaliSekmeNavigator);

const s = StyleSheet.create({
  kap: { flex: 1, backgroundColor: COLORS.bg },
  sahne: { flex: 1, overflow: "hidden", backgroundColor: COLORS.bg },
  serit: { flex: 1, flexDirection: "row" },
  sayfa: { height: "100%", overflow: "hidden", backgroundColor: COLORS.bg },
});
