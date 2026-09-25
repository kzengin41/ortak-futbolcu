import React, { useEffect, useRef, useState } from "react";
import { View, Animated, StyleSheet, Modal } from "react-native";
// Tur başlamadan önce 3-2-1 geri sayımı.
export default function CountdownOverlay({ onComplete, countPlayers, isMirrored }) {
  const [display, setDisplay] = useState("3");
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let interval;
    let timeout;
    
    function playCount(idx) {
      try {
        const p = countPlayers && countPlayers[idx];
        if (!p) return;
        p.seekTo(0);
        p.play();
      } catch {}
    }

    function pop() {
      scale.setValue(0.35);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 140 }),
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
    }

    const sequence = ["3", "2", "1"];
    let i = 0;
    
    timeout = setTimeout(() => {
      pop();
      playCount(i);

      interval = setInterval(() => {
        i++;
        if (i >= sequence.length) {
          clearInterval(interval);
          setTimeout(onComplete, 450);
          return;
        }
        setDisplay(sequence[i]);
        pop();
        playCount(i);
      }, 800);
    }, 300);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 7 Eylül 2026 (Kerem: "önce ülke ve takımı gösterip sonra 3-2-1 diye
  // sayıyor, bu oyunun mantığına aykırı — takımlar sayım BİTİNCE görünmeli")
  // — KÖK NEDEN: geri sayım katmanı `StyleSheet.absoluteFillObject` ile
  // ekranın TAMAMINI değil, İÇİNDE BULUNDUĞU KABIN İÇ ALANINI kaplıyordu.
  // GameBackground artık içeriği padding'li bir View'a sardığı için (17. tur)
  // katman her kenardan padding kadar İÇERİDE kalıyor ve altındaki tur
  // içeriği (ülke/kulüp kartı) kenarlardan sızıyordu.
  // ÇÖZÜM: geri sayım artık bir `Modal` içinde — hangi ekranda, hangi kabın
  // içinde olursa olsun TÜM ekranı (durum çubuğu dahil) kaplıyor.
  if (isMirrored) {
    return (
      <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={[styles.bg, { transform: [{ rotate: "180deg" }] }]}>
          <Animated.Text style={[styles.number, { transform: [{ scale }], opacity }]}>{display}</Animated.Text>
        </View>
        <View style={styles.bg}>
          <Animated.Text style={[styles.number, { transform: [{ scale }], opacity }]}>{display}</Animated.Text>
        </View>
      </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.bg}>
          <Animated.Text style={[styles.number, { transform: [{ scale }], opacity }]}>{display}</Animated.Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // 11 Eylül 2026 (Kerem: "3-2-1 sayılırken ekran TAMAMEN BEYAZ oluyor") —
  // KÖK NEDEN: Modal'a taşırken bu katman hâlâ `absoluteFillObject` ile
  // konumlanıyordu. Modal'ın kendi kök görünümü Android'de bu absolute
  // çocuğa ölçü vermediği için katman ÇİZİLMİYOR, geriye Modal'ın kendi
  // beyaz penceresi kalıyordu. Ayrıca `presentationStyle="overFullScreen"`
  // sadece iOS içindir ve verildiğinde `transparent` ayarını geçersiz kılar.
  // ÇÖZÜM: absolute konumlandırma yok — düz `flex: 1` ile Modal'ın tamamını
  // kaplıyor ve arka planı kendisi boyuyor.
  overlay: {
    flex: 1,
    backgroundColor: "#0B1620",
  },
  bg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  number: { color: "#7CFF5C", fontSize: 110, fontWeight: "900" },
});
