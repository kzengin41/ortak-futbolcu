// 4 Ekim 2026 (Kerem: "ortak futbolcu modunda klavye cevap kısmını
// kapatıyor. öneri futbolcuyu göremiyorum. bunu tüm modlar için düzeltmemiz
// lazım.")
//
// KÖK NEDEN: SDK 57'de Android uygulaması edge-to-edge çiziliyor; klavye
// açılınca pencere artık küçülmüyor (eski adjustResize davranışı yok).
// Ekranlardaki KeyboardAvoidingView'lerin hepsi Android'de ya kapalıydı
// (behavior undefined) ya da "height" moddaydı ve yalnızca cevap bölümünü
// sarıyordu — ikisi de işe yaramıyordu.
//
// ÇÖZÜM — tek yerden, her modda aynı davranış:
//  • KlavyeAlani: klavyenin bu kutuyla GERÇEKTEN çakıştığı kadar alt boşluk
//    verir (pencere zaten küçülüyorsa çakışma 0 çıkar, çift boşluk olmaz).
//    iOS ve Android'de aynı hesap.
//  • KlavyeScroll: ScrollView'in yerine geçer; klavye açılınca ve öneriler
//    çıkınca odaktaki yazı kutusunu görünür alanın üstüne kaydırır, böylece
//    altındaki öneri listesi klavyenin üstünde kalır.
//  • GameBackground'a `klavye="kaydir"` verilince ekranın tamamı bu ikisiyle
//    sarılır (ScrollView'i olmayan oyun ekranları için).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView, TextInput, View } from "react-native";

const ACILIS = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const KAPANIS = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

// Klavyenin üst kenarının ekrandaki y'si (açık değilse null). Birden çok
// bileşen aynı anda soruyor; tek dinleyici yeterli.
let klavyeUstY = null;
const aboneler = new Set();
let dinleyiciler = null;
function abone(fn) {
  aboneler.add(fn);
  if (!dinleyiciler) {
    const ac = (e) => {
      const y = e?.endCoordinates?.screenY;
      klavyeUstY = typeof y === "number" && y > 0 ? y : null;
      aboneler.forEach((f) => f(klavyeUstY));
    };
    const kapa = () => {
      klavyeUstY = null;
      aboneler.forEach((f) => f(null));
    };
    const degis = Platform.OS === "ios" ? Keyboard.addListener("keyboardWillChangeFrame", ac) : null;
    dinleyiciler = [Keyboard.addListener(ACILIS, ac), Keyboard.addListener(KAPANIS, kapa), degis].filter(Boolean);
  }
  return () => {
    aboneler.delete(fn);
    if (aboneler.size === 0 && dinleyiciler) {
      dinleyiciler.forEach((d) => d.remove());
      dinleyiciler = null;
    }
  };
}

// Klavye açık mı? (Ekranlar açıkken üst kısmı sıkıştırmak için kullanıyor.)
export function useKlavyeAcik() {
  const [acik, setAcik] = useState(klavyeUstY != null);
  useEffect(() => abone((y) => setAcik(y != null)), []);
  return acik;
}

export function KlavyeAlani({ style, children, ...rest }) {
  const ref = useRef(null);
  const [pay, setPay] = useState(0);

  const hesapla = useCallback((ustY) => {
    if (ustY == null) {
      setPay(0);
      return;
    }
    const el = ref.current;
    if (!el || typeof el.measureInWindow !== "function") return;
    el.measureInWindow((x, y, w, h) => {
      // Kutunun alt kenarı klavyenin üstünden ne kadar aşağıda? O kadar boşluk.
      const cakisma = Math.max(0, Math.round(y + h - ustY));
      setPay(cakisma);
    });
  }, []);

  useEffect(() => abone(hesapla), [hesapla]);

  return (
    <View ref={ref} style={[{ flex: 1 }, style, pay > 0 && { paddingBottom: pay }]} {...rest}>
      {children}
    </View>
  );
}

// ekPay: yazı kutusunun altında görünür kalması gereken alan (öneri listesi).
export const KlavyeScroll = React.forwardRef(function KlavyeScroll(
  { ekPay = 170, onScroll, onLayout, onContentSizeChange, children, ...rest },
  disRef
) {
  const ref = useRef(null);
  const ofset = useRef(0);
  const zaman = useRef(null);

  const baglaRef = useCallback(
    (el) => {
      ref.current = el;
      if (typeof disRef === "function") disRef(el);
      else if (disRef) disRef.current = el;
    },
    [disRef]
  );

  const ayarla = useCallback(() => {
    if (klavyeUstY == null) return;
    const girdi = TextInput.State?.currentlyFocusedInput?.();
    const sv = ref.current;
    if (!girdi || !sv || typeof girdi.measureInWindow !== "function" || typeof sv.measureInWindow !== "function") return;
    sv.measureInWindow((sx, sy, sw, sh) => {
      girdi.measureInWindow((gx, gy, gw, gh) => {
        const ust = sy + 8;
        const alt = Math.min(sy + sh, klavyeUstY) - 8;
        if (alt <= ust) return;
        let fark = 0;
        if (gy < ust) fark = gy - ust; // kutu yukarıda kalmış
        else if (gy + gh + ekPay > alt) fark = Math.min(gy + gh + ekPay - alt, gy - ust); // aşağıda
        if (Math.abs(fark) < 4) return;
        sv.scrollTo?.({ y: Math.max(0, ofset.current + fark), animated: true });
      });
    });
  }, [ekPay]);

  const planla = useCallback(
    (ms = 60) => {
      clearTimeout(zaman.current);
      zaman.current = setTimeout(ayarla, ms);
    },
    [ayarla]
  );

  useEffect(() => {
    const kapat = abone((ustY) => {
      if (ustY != null) {
        // Alan boşluğu (KlavyeAlani) bir kare sonra uygulanıyor; iki kez dene.
        planla(120);
        setTimeout(ayarla, 350);
      }
    });
    return () => {
      kapat();
      clearTimeout(zaman.current);
    };
  }, [planla, ayarla]);

  return (
    <ScrollView
      ref={baglaRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...rest}
      onScroll={(e) => {
        ofset.current = e?.nativeEvent?.contentOffset?.y ?? ofset.current;
        onScroll?.(e);
      }}
      onLayout={(e) => {
        if (klavyeUstY != null) planla();
        onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        // Öneriler belirince içerik uzar — kutuyu yeniden yerleştir.
        if (klavyeUstY != null) planla();
        onContentSizeChange?.(w, h);
      }}
    >
      {children}
    </ScrollView>
  );
});
