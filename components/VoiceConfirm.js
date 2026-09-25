import React from "react";
import { View, Text, StyleSheet } from "react-native";
import SoundPressable from "./SoundPressable";
import { COLORS, SPACING, TYPE } from "../lib/theme";

// 25 Eylül 2026 (Kerem: "sesli söylediğimde anladığını ekrana getirsin,
// onaylayayım. anlamadığı senaryolar için bir çıkış yolu olsun. ama
// kullanmak istemeyenler için bu ayar kapatılabilsin.")
//
// Eskiden sesli cevap Whisper'dan döner dönmez DOĞRUDAN gönderiliyordu —
// yanlış anlaşıldığında kullanıcı bunu ancak "yanlış cevap" yedikten sonra
// fark ediyordu ve turu kaybediyordu. Artık araya bu onay adımı giriyor.
//
// Üç çıkış yolu var, çünkü tanıma üç farklı şekilde bozulabiliyor:
//   Gönder        -> doğru anladı, devam
//   Tekrar konuş  -> yanlış anladı, yeniden söyleyecek
//   Yazarak düzelt-> ses hiç tutmuyor (gürültü, aksan), klavyeye geçiyor
// Ayrıca "Vazgeç" var: kullanıcı cevabı hiç göndermek istemiyorsa.
//
// Onay penceresi açıkken sayaç DURUYOR (bkz. ekranlardaki
// "isProcessing || sesOnayIstegi" koşulu) — yoksa okuma süresi cezaya
// dönüşürdü ve klavye kullananlara göre haksızlık olurdu.
export default function VoiceConfirm({ istek, onOnayla, onTekrar, onYaz, onIptal }) {
  if (!istek) return null;
  const { duyulan, ad, tanindi } = istek;
  const hamFarkli = duyulan && ad && duyulan.trim().toLowerCase() !== ad.trim().toLowerCase();

  return (
    <View style={styles.kap}>
      <Text style={styles.ustYazi}>{tanindi ? "BUNU MU DEDİN?" : "ŞUNU DUYDUM"}</Text>

      <Text style={styles.ad} numberOfLines={2}>{ad}</Text>
      {hamFarkli ? <Text style={styles.ham}>ses kaydı: "{duyulan}"</Text> : null}

      {!tanindi ? (
        <Text style={styles.uyari}>
          Bu isim listede bulunamadı. Yine de göndermek istersen Gönder'e bas, ya da düzelt.
        </Text>
      ) : null}

      <View style={styles.satir}>
        <SoundPressable style={[styles.btn, styles.btnOnay]} onPress={() => onOnayla(ad)}>
          <Text style={styles.btnOnayText}>Gönder</Text>
        </SoundPressable>
        <SoundPressable style={styles.btn} onPress={onTekrar}>
          <Text style={styles.btnText}>Tekrar konuş</Text>
        </SoundPressable>
      </View>

      <View style={styles.satir}>
        <SoundPressable style={[styles.btn, styles.btnGenis]} onPress={() => onYaz(ad)}>
          <Text style={styles.btnText}>Yazarak düzelt</Text>
        </SoundPressable>
      </View>

      <SoundPressable style={styles.vazgec} onPress={onIptal}>
        <Text style={styles.vazgecText}>Vazgeç</Text>
      </SoundPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  kap: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 14,
    padding: SPACING.md,
  },
  ustYazi: { ...TYPE.eyebrow, textAlign: "center", marginBottom: 6 },
  ad: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 2,
  },
  ham: { ...TYPE.caption, textAlign: "center", marginBottom: 4 },
  uyari: {
    ...TYPE.bodyMuted,
    color: COLORS.danger,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  satir: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  btnGenis: { flex: 1 },
  btnOnay: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  btnText: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  btnOnayText: { color: COLORS.accentDark, fontSize: 15, fontWeight: "900" },
  vazgec: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16, marginTop: 2 },
  vazgecText: { ...TYPE.caption, textDecorationLine: "underline" },
});
