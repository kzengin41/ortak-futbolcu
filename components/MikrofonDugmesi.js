import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import SoundPressable from "./SoundPressable";
import { useVoiceInput } from "../lib/useVoiceInput";
import { useAppSettings } from "../lib/SettingsContext";
import { COLORS, saydam } from "../lib/theme";

// ============================================================================
// MİKROFON DÜĞMESİ — Paket 37 (16 Ekim 2026)
// Kerem: "mikrofon tüm modlarda olmalı. online offline fark etmez."
// Sesli cevabı olmayan ekranlara (online modlar, Harf Zinciri, Kadro Avı,
// günlük oyunlar…) tek satırla eklenebilen düğme. Konuşurken telefonun
// duyduğu yazı ekranın üstünde canlı görünür (components/CanliSesBalonu).
// Bitince:
//   • "Sesli cevabı onayla" açıksa (varsayılan) duyulan metin cevap kutusuna
//     YAZILIR (onMetin) — oyuncu bakar, gönderir ya da düzeltir.
//   • kapalıysa doğrudan gönderilir (onGonder; yoksa onMetin).
// ipucu: Whisper yedeğine gidecek isim ipuçları (isteğe bağlı fonksiyon).
// ============================================================================
export default function MikrofonDugmesi({ onMetin, onGonder, ipucu, disabled, boyut = 44, style, renk }) {
  const { settings } = useAppSettings();
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceInput(ipucu);
  const [hata, setHata] = useState(null);
  const onayli = settings?.voiceConfirm !== false;

  async function bas() {
    setHata(null);
    if (isRecording) {
      try {
        const metin = await stopRecording();
        if (!metin) { setHata("Anlayamadım"); return; }
        if (!onayli && onGonder) onGonder(metin);
        else onMetin && onMetin(metin);
      } catch (e) {
        setHata("Ses tanınamadı");
      }
    } else {
      try { await startRecording(); } catch (e) { setHata("Mikrofon izni yok"); }
    }
  }

  return (
    <View style={style}>
      <SoundPressable
        onPress={bas}
        disabled={disabled || isProcessing}
        style={[
          s.dugme,
          { width: boyut, height: boyut, borderRadius: Math.round(boyut * 0.28) },
          isRecording && s.kayit,
          (disabled || isProcessing) && { opacity: 0.5 },
        ]}
        accessibilityLabel={isRecording ? "Kaydı bitir" : "Sesle söyle"}
        hitSlop={4}
      >
        {isProcessing ? (
          <ActivityIndicator size="small" color={COLORS.text} />
        ) : (
          <Ionicons name={isRecording ? "stop" : "mic"} size={Math.round(boyut * 0.45)} color={isRecording ? "#FFFFFF" : renk || COLORS.text} />
        )}
      </SoundPressable>
      {hata ? <Text style={s.hata} numberOfLines={1}>{hata}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  dugme: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: saydam(COLORS.text, 0.08), borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  kayit: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  hata: { position: "absolute", top: "100%", alignSelf: "center", marginTop: 2, fontSize: 10, fontWeight: "700", color: COLORS.danger, width: 90, textAlign: "center" },
});
